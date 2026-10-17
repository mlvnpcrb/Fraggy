"""Conservative, deterministic matching. Source data is never merged or modified."""
import argparse
import hashlib
import json
import re
import unicodedata
from uuid import uuid4
from sqlalchemy import select
from .db import (CanonicalPerfume, CanonicalLink, MatchReview, MatchEvent,
                 Perfume, BrandAlias, database, now)


def normalize(value):
    text = unicodedata.normalize('NFKD', str(value or '')).casefold()
    text = ''.join(char for char in text if not unicodedata.combining(char))
    return re.sub(r'[\W_]+', ' ', text, flags=re.UNICODE).strip()


def normalize_brand(value):
    return normalize(str(value or '').replace('&', ' and '))


def resolve_brand(session, value):
    brand = normalize_brand(value)
    visited = set()
    for _ in range(16):
        if brand in visited:
            raise ValueError('Brand alias cycle requires operator correction')
        visited.add(brand)
        row = session.scalar(select(BrandAlias).where(BrandAlias.alias == brand).order_by(BrandAlias.id.desc()).limit(1))
        if not row or row.canonical_brand == brand:
            return brand
        brand = row.canonical_brand
    raise ValueError('Brand alias chain is too long')


def set_brand_alias(session, alias, target, actor, reason):
    alias, target = normalize_brand(alias), normalize_brand(target)
    if not alias or not target or not actor.strip() or not reason.strip():
        raise ValueError('Nonempty brands, actor and reason are required')
    previous = session.scalar(select(BrandAlias).where(BrandAlias.alias == alias).order_by(BrandAlias.id.desc()).limit(1))
    if previous and previous.canonical_brand == target:
        return previous.id
    if alias != target and resolve_brand(session, target) == alias:
        raise ValueError('Brand alias would create a cycle')
    row = BrandAlias(alias=alias, canonical_brand=target, actor=actor, reason=reason)
    session.add(row)
    session.flush()
    return row.id


PATTERNS = [
    ('edp', r'\b(?:eau\s+de\s+parfum|edp)\b'),
    ('edt', r'\b(?:eau\s+de\s+toilette|edt)\b'),
    ('extrait', r'\b(?:extrait(?:\s+de\s+parfum)?)\b'),
    ('elixir', r'\belixir\b'),
    ('parfum', r'\bparfum\b'),
    ('edc', r'\b(?:eau\s+de\s+cologne|edc)\b'),
]


def concentrations(value):
    text = normalize(value)
    found = set()
    for concentration, pattern in PATTERNS:
        if re.search(pattern, text):
            found.add(concentration)
            text = re.sub(pattern, ' ', text)
    return found, re.sub(r'\s+', ' ', text).strip()


def profile(record, session=None):
    data = record.data
    raw_brand = data.get('brand') or record.brand
    name_brand = normalize(raw_brand)
    brand = resolve_brand(session, raw_brand) if session else normalize_brand(raw_brand)
    name = normalize(data.get('name') or record.name)
    # Strip only full brand prefixes/suffixes, never occurrences within a name.
    if name_brand and name.startswith(name_brand + ' '):
        name = name[len(name_brand) + 1:]
    if name_brand and name.endswith(' ' + name_brand):
        name = name[:-len(name_brand) - 1]
    from_name, base_name = concentrations(name)
    explicit, remainder = concentrations(data.get('concentration'))
    uncertain = bool(data.get('concentration') and (not explicit or remainder))
    if explicit and from_name and explicit != from_name:
        uncertain = True
    concentration_set = explicit or from_name
    # Compound labels remain distinct; conflicting major concentrations need review.
    if len(concentration_set - {'elixir'}) > 1:
        uncertain = True
    concentration = '+'.join(sorted(concentration_set)) or None
    year = data.get('release_year')
    if isinstance(year, bool) or not isinstance(year, int) or not 1700 <= year <= 2200:
        year = None
    result = {'brand': brand, 'name': base_name, 'concentration': concentration, 'year': year,
              'uncertain': uncertain}
    result['complete'] = bool(brand and base_name and concentration and year and not uncertain)
    return result


def fingerprint(identity):
    return hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()


def snapshot(link):
    if link is None:
        return None
    return {key: getattr(link, key) for key in
            ('canonical_id', 'confidence', 'method', 'locked', 'fingerprint', 'updated_at')}


def write_link(session, record_id, target, confidence, method, locked, signature, actor, reason,
               review_changes=None):
    link = session.get(CanonicalLink, record_id)
    before = snapshot(link)
    # No new audit event or timestamp for an identical decision.
    desired = {'canonical_id': target, 'confidence': confidence, 'method': method,
               'locked': locked, 'fingerprint': signature}
    if before and all(before[key] == value for key, value in desired.items()) and not review_changes:
        return None
    if link is None:
        link = CanonicalLink(perfume_id=record_id, **desired, updated_at=now())
        session.add(link)
    else:
        for key, value in desired.items():
            setattr(link, key, value)
        link.updated_at = now()
    session.flush()
    event = MatchEvent(id=str(uuid4()), perfume_id=record_id, before=before, after=snapshot(link),
                       actor=actor, reason=reason, review_changes=review_changes or [])
    session.add(event)
    session.flush()
    return event.id


def compatible(identity, canonical):
    return (not identity['uncertain']
            and (not identity['concentration'] or not canonical.concentration or identity['concentration'] == canonical.concentration)
            and (not identity['year'] or not canonical.release_year or identity['year'] == canonical.release_year))


def match_record(session, record):
    session.flush()
    identity = profile(record, session)
    signature = fingerprint(identity)
    current = session.get(CanonicalLink, record.id)
    if current and current.locked:
        if current.canonical_id:
            target = session.get(CanonicalPerfume, current.canonical_id)
            if not compatible(identity, target):
                review = session.scalar(select(MatchReview).where(MatchReview.perfume_id == record.id,
                    MatchReview.canonical_id == target.id, MatchReview.fingerprint == signature))
                if review is None:
                    session.add(MatchReview(perfume_id=record.id, canonical_id=target.id,
                        fingerprint=signature, confidence=0.0, status='pending',
                        reason='Source identity conflicts with a locked decision; detached, correct identity before approval'))
                write_link(session, record.id, None, 0.0, 'manual-conflict', True, signature,
                           'matcher-v1', 'Source identity now conflicts with locked match; detached for review')
        return current.canonical_id
    # Mark obsolete pending suggestions; past decisions remain auditable.
    for review in session.scalars(select(MatchReview).where(MatchReview.perfume_id == record.id,
                                                           MatchReview.status == 'pending')):
        if review.fingerprint != signature:
            review.status = 'stale'
    candidates = list(session.scalars(select(CanonicalPerfume).where(
        CanonicalPerfume.normalized_brand == identity['brand'],
        CanonicalPerfume.normalized_name == identity['name'],
        CanonicalPerfume.id.in_(select(CanonicalLink.canonical_id).where(CanonicalLink.perfume_id != record.id))))) if identity['brand'] and identity['name'] else []
    key = 'exact:' + signature if identity['complete'] else 'source:' + str(record.id) + ':' + signature
    target = session.scalar(select(CanonicalPerfume).where(CanonicalPerfume.match_key == key))
    if target is None:
        target = CanonicalPerfume(id=str(uuid4()), match_key=key,
            name=identity['name'], brand=record.brand, normalized_brand=identity['brand'],
            normalized_name=identity['name'], concentration=identity['concentration'],
            release_year=identity['year'], provisional=not identity['complete'])
        session.add(target)
        session.flush()
    for candidate in candidates:
        if identity['complete'] or candidate.id == target.id or not compatible(identity, candidate):
            continue
        if candidate.provisional and (candidate.created_at, candidate.id) >= (target.created_at, target.id):
            continue  # One stable direction for incomplete-to-incomplete suggestions.
        # Exact known profiles already use the same canonical key. Everything else requires review.
        score = 0.60 + (0.25 if identity['concentration'] and identity['concentration'] == candidate.concentration else 0) + (0.15 if identity['year'] and identity['year'] == candidate.release_year else 0)
        review = session.scalar(select(MatchReview).where(MatchReview.perfume_id == record.id,
            MatchReview.canonical_id == candidate.id, MatchReview.fingerprint == signature))
        if review is None:
            session.add(MatchReview(perfume_id=record.id, canonical_id=candidate.id,
                fingerprint=signature, confidence=min(score, 0.95), status='pending',
                reason='Matching normalized brand/name; incomplete identity requires human review'))
    write_link(session, record.id, target.id, 1.0 if identity['complete'] else 0.0,
               'exact' if identity['complete'] else 'provisional', False, signature,
               'matcher-v1', 'Exact full identity' if identity['complete'] else 'Isolated until identity is complete or reviewed')
    return target.id


def manual_link(session, record_id, canonical_id, actor, reason, review_id=None):
    record = session.get(Perfume, record_id)
    target = session.get(CanonicalPerfume, canonical_id)
    if not record or not target:
        raise ValueError('Source record or canonical perfume not found')
    identity = profile(record, session)
    if not compatible(identity, target):
        raise ValueError('Conflicting or uncertain concentration/year; correct identity before linking')
    signature = fingerprint(identity)
    changes = []
    if review_id is not None:
        review = session.get(MatchReview, review_id)
        if not review or review.perfume_id != record_id or review.canonical_id != canonical_id:
            raise ValueError('Review does not identify this match')
        if review.fingerprint != signature or review.status != 'pending':
            raise ValueError('Review is stale or already resolved')
        changes = [{'id': review.id, 'before': review.status, 'after': 'accepted'}]
        review.status = 'accepted'
    return write_link(session, record_id, canonical_id, 1.0, 'manual', True, signature,
                      actor, reason, changes)


def unlink(session, record_id, actor, reason):
    record = session.get(Perfume, record_id)
    if not record:
        raise ValueError('Source record not found')
    return write_link(session, record_id, None, 0.0, 'manual-unlink', True,
                      fingerprint(profile(record, session)), actor, reason)


def reject_review(session, review_id, actor, reason):
    review = session.get(MatchReview, review_id)
    if not review or review.status != 'pending':
        raise ValueError('Pending review not found')
    record = session.get(Perfume, review.perfume_id)
    if review.fingerprint != fingerprint(profile(record, session)):
        raise ValueError('Review identity changed; rerun matching')
    link = session.get(CanonicalLink, record.id)
    state = snapshot(link)
    review.status = 'rejected'
    event = MatchEvent(id=str(uuid4()), perfume_id=record.id, before=state, after=state,
        actor=actor, reason=reason, review_changes=[{'id': review.id, 'before': 'pending', 'after': 'rejected'}])
    session.add(event)
    session.flush()
    return event.id


def undo(session, event_id, actor, reason):
    event = session.get(MatchEvent, event_id)
    if not event or event.undone_at:
        raise ValueError('Active decision not found')
    link = session.get(CanonicalLink, event.perfume_id)
    if snapshot(link) != event.after:
        raise ValueError('A later decision changed this record; undo that decision first')
    if event.before and event.before['canonical_id']:
        record = session.get(Perfume, event.perfume_id)
        target = session.get(CanonicalPerfume, event.before['canonical_id'])
        if not compatible(profile(record, session), target):
            raise ValueError('Current source identity conflicts with the previous match')
    for change in event.review_changes:
        review = session.get(MatchReview, change['id'])
        if review.status != change['after']:
            raise ValueError('Review has changed since this decision')
        review.status = change['before']
    before = snapshot(link)
    if event.before is None:
        if link:
            session.delete(link)
    else:
        if link is None:
            link = CanonicalLink(perfume_id=event.perfume_id)
            session.add(link)
        for key, value in event.before.items():
            setattr(link, key, value)
    event.undone_at = now()
    reversal = MatchEvent(id=str(uuid4()), perfume_id=event.perfume_id, before=before,
        after=event.before, actor=actor, reason=f'Undo {event.id}: {reason}',
        review_changes=[{'id': item['id'], 'before': item['after'], 'after': item['before']} for item in event.review_changes],
        undone_at=now())
    session.add(reversal)
    session.flush()
    return reversal.id


def main():
    parser = argparse.ArgumentParser(description='Local operator workflow; no public mutation endpoints')
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('match')
    alias = commands.add_parser('brand-alias')
    alias.add_argument('alias')
    alias.add_argument('target')
    alias.add_argument('--actor', required=True)
    alias.add_argument('--reason', required=True)
    reviews = commands.add_parser('reviews')
    reviews.add_argument('--status', default='pending', choices=['pending', 'accepted', 'rejected', 'stale'])
    for action, argument in [('link', 'record_id'), ('unlink', 'record_id'), ('accept', 'review_id'), ('reject', 'review_id'), ('undo', 'event_id')]:
        command = commands.add_parser(action)
        command.add_argument(argument, type=str if action == 'undo' else int)
        if action == 'link':
            command.add_argument('canonical_id')
        command.add_argument('--actor', required=True)
        command.add_argument('--reason', required=True)
    args = parser.parse_args()
    factory = database()
    # Share the worker lock; operators must stop a long-running sync first.
    from .sync import worker_lock
    with worker_lock(), factory.begin() as session:
        if args.command == 'match':
            count = 0
            records = list(session.scalars(select(Perfume).order_by(Perfume.id)))
            for record in records:
                match_record(session, record)
                count += 1
            # Resolve suggestions against the complete membership set independent of input order.
            for record in records:
                match_record(session, record)
            print(json.dumps({'processed': count}))
        elif args.command == 'brand-alias':
            print(set_brand_alias(session, args.alias, args.target, args.actor, args.reason))
        elif args.command == 'reviews':
            for review in session.scalars(select(MatchReview).where(MatchReview.status == args.status).order_by(MatchReview.id)):
                print(json.dumps({key: getattr(review, key) for key in ('id', 'perfume_id', 'canonical_id', 'confidence', 'status', 'reason')}))
        elif args.command == 'link':
            print(manual_link(session, args.record_id, args.canonical_id, args.actor, args.reason))
        elif args.command == 'unlink':
            print(unlink(session, args.record_id, args.actor, args.reason))
        elif args.command == 'reject':
            print(reject_review(session, args.review_id, args.actor, args.reason))
        elif args.command == 'accept':
            review = session.get(MatchReview, args.review_id)
            if review is None:
                raise ValueError('Review not found')
            print(manual_link(session, review.perfume_id, review.canonical_id, args.actor, args.reason, review.id))
        else:
            print(undo(session, args.event_id, args.actor, args.reason))


if __name__ == '__main__':
    main()
