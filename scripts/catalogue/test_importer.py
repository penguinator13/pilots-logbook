from pathlib import Path
import copy
import os
import pytest
import importlib.util

ROOT = Path(__file__).parent
PDF = Path(os.environ.get('FAA_PDF_PATH', ROOT / 'faa7360.pdf'))

def load_importer():
    path = ROOT / 'import_faa.py'
    assert path.exists(), 'repeatable FAA importer is not implemented'
    spec = importlib.util.spec_from_file_location('import_faa', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def test_real_as50_layout_and_source():
    data = load_importer().build_catalog(PDF)
    assert data['source']['edition'] == 'JO 7360.1K'
    assert data['source']['effectiveDate'] == '2025-06-12'
    rows = [r for r in data['aircraft'] if r['icao'] == 'AS50']
    assert any(r['manufacturer'] == 'AIRBUS HELICOPTERS' and r['model'] == 'H-125 Ecureuil' for r in rows)
    assert all((r['category'], r['engineCount'], r['engineType'], r['wakeCategory']) == ('helicopter', 1, 'turbine', 'light') for r in rows)

def test_source_punctuation_is_resolved_only_with_explicit_evidence():
    data = load_importer().build_catalog(PDF)
    keys = {(r['icao'], r['manufacturer'], r['model']) for r in data['aircraft']}
    for expected in [('A109', 'AGUSTA', 'A-109 Grand'), ('A30B', 'AIRBUS', 'A-300B2-200'), ('BE80', 'BEECH', '80 Queen Air'), ('GAZL', 'SOKO', 'SA-341 Partizan'), ('PRET', 'GM&T', 'Pretty Flight')]:
        assert expected in keys
    assert len({r['icao'] for r in data['aircraft']}) == 2699

@pytest.mark.parametrize('code,manufacturer,model,count,engine', [
    ('B212','BELL','212',2,'turbine'),
    ('R44','ROBINSON','R-44 Raven',1,'piston'),
    ('B06','BELL','206A JetRanger',1,'turbine'),
])
def test_real_helicopters(code,manufacturer,model,count,engine):
    data = load_importer().build_catalog(PDF)
    matches = [r for r in data['aircraft'] if (r['icao'],r['manufacturer'],r['model']) == (code,manufacturer,model)]
    assert len(matches) == 1
    assert (matches[0]['category'],matches[0]['engineCount'],matches[0]['engineType']) == ('helicopter',count,engine)

def test_validation_counts_deduplication_and_headers():
    importer = load_importer()
    assert hasattr(importer, 'validate_catalog'), 'catalog validator missing'
    data = importer.build_catalog(PDF)
    importer.validate_catalog(data)
    assert len(data['aircraft']) == 7333
    bad = copy.deepcopy(data)
    bad['aircraft'].append(bad['aircraft'][0])
    with pytest.raises(ValueError, match='Duplicate'):
        importer.validate_catalog(bad)
    bad = copy.deepcopy(data)
    bad['aircraft'][0]['icao'] = 'Type'
    with pytest.raises(ValueError, match='Invalid'):
        importer.validate_catalog(bad)
    bad = copy.deepcopy(data)
    bad['source']['statistics']['aircraftRows'] = 1
    with pytest.raises(ValueError, match='Count'):
        importer.validate_catalog(bad)
