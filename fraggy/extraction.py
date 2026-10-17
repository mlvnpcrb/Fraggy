"""Explicit extraction observations, kept outside the public source data contract."""
from copy import deepcopy
from .db import now

STATES = {'missing', 'uncertain', 'empty', 'extracted'}


class Extraction(dict):
    def __init__(self, values, states=None):
        super().__init__(values)
        # Conservative fallback for parsers without explicit evidence.
        self.states = {key: ('missing' if value is None or value == [] or value == '' else 'extracted')
                       for key, value in values.items()}
        self.states.update(states or {})
        if any(state not in STATES for state in self.states.values()):
            raise ValueError('Unknown extraction state')
        for key, state in self.states.items():
            if state == 'empty' and (key not in self or self[key] not in ([], '', {})):
                raise ValueError('An empty observation requires an explicit empty value')


def merge_extraction(previous, observation, metadata=None):
    """Only accepted observations change values; unknown fields never erase data."""
    observation = observation if isinstance(observation, Extraction) else Extraction(observation)
    values = deepcopy(previous)
    observations = deepcopy(metadata or {})
    timestamp = now()
    for key, value in observation.items():
        state = observation.states[key]
        old = observations.get(key, {})
        evidence = {'state': state, 'observed_at': timestamp}
        if old.get('last_success_at'):
            evidence['last_success_at'] = old['last_success_at']
        if state in ('extracted', 'empty'):
            if key == 'offers' and state == 'extracted' and isinstance(value, list):
                previous_offers = values.get(key) or []
                combined = []
                for offer in value:
                    candidates = [old for old in previous_offers if any(offer.get(identity) and offer.get(identity) == old.get(identity) for identity in ('sku', 'url'))]
                    if not candidates and len(value) == len(previous_offers) == 1:
                        candidates = previous_offers
                    prior = candidates[0] if len(candidates) == 1 else {}
                    combined.append({**prior, **{field: item for field, item in offer.items() if item is not None or field not in prior}})
                values[key] = deepcopy(combined)
            else:
                values[key] = deepcopy(value)
            evidence['last_success_at'] = timestamp
        elif key not in values:
            # Retain legacy null/[] placeholders for new source records.
            if state == 'uncertain':
                values[key] = [] if isinstance(value, list) else ({field: None for field in value} if isinstance(value, dict) else None)
            else:
                values[key] = deepcopy(value)
        observations[key] = evidence
    return values, observations
