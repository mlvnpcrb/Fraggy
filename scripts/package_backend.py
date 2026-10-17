"""Create/verify a portable source bundle without local credentials or databases."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

REQUIRED = ('fraggy/__init__.py','fraggy/api.py','fraggy/db.py','fraggy/source.py','fraggy/sources.py',
            'fraggy/sync.py','fraggy/catalog.py','fraggy/extraction.py','fraggy/search.py','fraggy/http_policy.py',
            'fraggy/first_import.py','fraggy/web.py','fraggy/migrate.py','.env.render.example','Dockerfile','compose.yaml','compose.staging.yaml','requirements.lock',
            'pyproject.toml','.env.example','.env.staging.example','.dockerignore','.gitignore',
            'tests/test_workflow.py','tests/test_multisource.py','tests/test_integrity_catalog.py',
            'tests/test_readiness.py','tests/test_first_import.py','scripts/validate_docker.py',
            'scripts/validate_postgres.py','scripts/package_backend.py','docs/external-staging.md','docs/migrations.md','README.md','START-HERE.md')
NEW_REQUIRED = ('fraggy/web.py', 'fraggy/migrate.py', '.env.render.example',
                'scripts/backup_postgres.py', 'tests/test_deployment.py',
                'docs/render-free.md', 'docs/render-free-settings.json', 'docs/supabase-free.md',
                'docs/first-import-operator.md', 'docs/database-backup.md',
                'docs/frontend-integration.md', 'docs/render-supabase-verification.md',
                'docs/deployment-readiness.md')
LEGACY_REQUIRED = tuple(path for path in REQUIRED if path not in NEW_REQUIRED)
REQUIRED = tuple(dict.fromkeys((*REQUIRED, *NEW_REQUIRED)))
TOP = {path for path in REQUIRED if '/' not in path}


def allowed(relative):
    parts=relative.parts
    if any(part in ('.git','.venv','__pycache__','.pytest_cache','var') for part in parts):return False
    if relative.name.startswith('.env') and relative.name not in ('.env.example','.env.staging.example','.env.render.example'):return False
    if len(parts)==1:return relative.name in TOP
    if parts[0]=='inputs':return relative.name.endswith('.example')
    if parts[0]=='wheelhouse':return relative.suffix=='.whl'
    if parts[0] in ('fraggy','tests','scripts'):return relative.suffix=='.py'
    if parts[0]=='docs':return relative.suffix in ('.md', '.json')
    return False


def verify(path):
    with zipfile.ZipFile(path) as archive:
        if archive.testzip():raise ValueError('Archive CRC failure')
        names=archive.namelist()
        if len(names)!=len(set(names)):raise ValueError('Duplicate archive entries')
        manifest=json.loads(archive.read('FraggyAPI/PACKAGE-MANIFEST.json'))
        for name in names:
            parts=Path(name).parts
            if not parts or parts[0]!='FraggyAPI' or '..' in parts or Path(name).is_absolute():
                raise ValueError('Unsafe archive path')
        if manifest.get('format') not in (1, 2):raise ValueError('Unsupported package format')
        for relative in (LEGACY_REQUIRED if manifest['format']==1 else REQUIRED):
            if 'FraggyAPI/'+relative not in names:raise ValueError('Required file missing: '+relative)
        expected={'FraggyAPI/'+relative for relative in manifest['files']} | {'FraggyAPI/PACKAGE-MANIFEST.json'}
        if set(names)!=expected:raise ValueError('Manifest file inventory mismatch')
        for relative,digest in manifest['files'].items():
            if not allowed(Path(relative)):raise ValueError('Unexpected private/local file')
            if hashlib.sha256(archive.read('FraggyAPI/'+relative)).hexdigest()!=digest:
                raise ValueError('Checksum mismatch: '+relative)
    return {'files_verified':len(manifest['files']), 'migrations':'inline additive migrations in fraggy/db.py',
            'wheel_count':sum(name.endswith('.whl') for name in manifest['files'])}


def build(root,output):
    root=Path(root);output=Path(output)
    if output.exists():raise ValueError('Refusing to overwrite an existing export')
    files={str(path.relative_to(root)):path for path in root.rglob('*')
           if path.is_file() and not path.is_symlink() and allowed(path.relative_to(root))}
    missing=set(REQUIRED)-files.keys()
    if missing:raise ValueError('Required files missing: '+', '.join(sorted(missing)))
    manifest={'format':2,'migrations':'inline additive migrations in fraggy/db.py',
              'wheelhouse_platform':'CPython 3.12 / Linux x86_64',
              'files':{name:hashlib.sha256(path.read_bytes()).hexdigest() for name,path in sorted(files.items())}}
    output.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(output,'x',zipfile.ZIP_DEFLATED) as archive:
        for name,path in sorted(files.items()):archive.write(path,'FraggyAPI/'+name)
        archive.writestr('FraggyAPI/PACKAGE-MANIFEST.json',json.dumps(manifest,indent=2))
    result=verify(output)
    digest=hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix('.sha256').write_text(digest+'  '+output.name+'\n')
    return {**result,'archive':str(output),'sha256':digest}


def main():
    parser=argparse.ArgumentParser()
    sub=parser.add_subparsers(dest='action',required=True)
    package=sub.add_parser('build');package.add_argument('--root',type=Path,default=Path('.'));package.add_argument('--output',type=Path,required=True)
    check=sub.add_parser('verify');check.add_argument('archive',type=Path)
    args=parser.parse_args()
    print(json.dumps(build(args.root,args.output) if args.action=='build' else verify(args.archive)))


if __name__=='__main__':main()
