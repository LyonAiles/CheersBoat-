"""Conservative Actions cleanup. Dry run unless --apply; never deletes Releases."""
import json, os, sys, urllib.request

REPO = os.environ.get('GITHUB_REPOSITORY', 'LyonAiles/CheersBoat-')
BASE = 'https://api.github.com/repos/' + REPO

def api(path, method='GET'):
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'Nautic-storage-maintenance'}
    if os.environ.get('GH_TOKEN'):
        headers['Authorization'] = 'Bearer ' + os.environ['GH_TOKEN']
    with urllib.request.urlopen(urllib.request.Request(BASE + path, headers=headers, method=method), timeout=60) as r:
        return json.load(r) if method == 'GET' else None

def pages(path, key=None):
    result = []
    for page in range(1, 1000):
        data = api(f'{path}?per_page=100&page={page}')
        rows = data[key] if key else data
        result.extend(rows)
        if len(rows) < 100:
            return result
    raise RuntimeError('Pagination incomplete; cleanup cancelled')

def select(artifacts, caches, releases):
    published = {r['target_commitish'] for r in releases if not r.get('draft') and not r.get('prerelease') and any(a['name'] == 'app-release.apk' and a.get('state') == 'uploaded' and a.get('size', 0) > 0 for a in r.get('assets', []))}
    live = sorted((a for a in artifacts if not a.get('expired')), key=lambda a: a['created_at'], reverse=True)
    protected = {a['id'] for a in live[:5]}
    duplicates = [a for a in live if a['id'] not in protected and a['name'] == 'Nautic-APK-Signe' and a.get('workflow_run', {}).get('head_sha') in published]
    stale = []
    for family in ('gradle-home', 'gradle-groovy-dsl', 'gradle-instrumented-jars'):
        rows = sorted((c for c in caches if c['key'].startswith(family + '-v1')), key=lambda c: c['last_accessed_at'], reverse=True)
        stale.extend(rows[5:])
    return duplicates, stale

def main():
    artifacts = pages('/actions/artifacts', 'artifacts')
    caches = pages('/actions/caches', 'actions_caches')
    releases = pages('/releases')
    duplicates, stale = select(artifacts, caches, releases)
    before = sum(a['size_in_bytes'] for a in artifacts if not a.get('expired'))
    freed = 0
    apply = '--apply' in sys.argv
    for path, rows in (('/actions/artifacts/', duplicates), ('/actions/caches/', stale)):
        for row in rows:
            if apply:
                api(path + str(row['id']), 'DELETE')
            freed += row['size_in_bytes']
    report = {'applied': apply, 'artifacts_deleted_or_selected': len(duplicates), 'caches_deleted_or_selected': len(stale), 'bytes_freed_or_selected': freed, 'artifact_bytes_before': before, 'artifact_bytes_after': before - (sum(a['size_in_bytes'] for a in duplicates) if apply else 0), 'releases_preserved': len(releases)}
    print(json.dumps(report, indent=2))
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as f:
            f.write('### Stockage Nautic\n```json\n' + json.dumps(report, indent=2) + '\n```\nToutes les Releases sont conservées. Les anciens APK sans copie publiée sont conservés.\n')
    if report['artifact_bytes_after'] > 400_000_000:
        print('::warning::Artifacts above 400 MB; inspect storage. This is not the account billing quota.')

if __name__ == '__main__':
    main()
