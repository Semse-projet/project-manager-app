import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const script=readFileSync(new URL('../../scripts/field-memory-offsite-recovery-windows.ps1',import.meta.url),'utf8');
test('Windows recovery offers a safe Preflight mode and no Railway Restore',()=>{
  assert.match(script,/ValidateSet\('Preflight','ExportAndVerify'\)/);
  assert.match(script,/\$Mode -eq 'Preflight'/);
  assert.match(script,/--dry-run/);
  assert.doesNotMatch(script, /railway\s+(?:volume\s+)?restore\b/i);
  assert.doesNotMatch(script, /railway\s+redeploy\b/i);
});
test('real export requires both encryption and suspended uploads',()=>{
  assert.match(script,/\$EncryptedStorageConfirmed/);
  assert.match(script,/\$UploadsQuiescedConfirmed/);
  assert.match(script,/Get-BitLockerVolume/);
  assert.match(script,/ProtectionStatus/);
  assert.match(script,/if \(-not \$UploadsQuiescedConfirmed\)/);
});
test('reads original bytes only from verified /data mount via Railway SSH/SCP',()=>{
  assert.match(script,/SEMSE_STORAGE_ROOT/);
  assert.match(script,/if \(\$value -notmatch '\^\/data\//);
  assert.match(script,/node --input-type=module - \$Reference/);
  assert.match(script,/& scp -r \$remoteSpec \$exportDir/);
});
test('gates two inventories and requires verified offline restore',()=>{
  assert.match(script,/manifest-before\.json/);
  assert.match(script,/manifest-after\.json/);
  assert.match(script,/field-memory-custody-gate\.mjs/);
  assert.match(script,/OFFSITE_RESTORE_PASS/);
  assert.match(script,/captureSessionActivationPermitted/);
  assert.match(script,/Assert-Exit 'Gate de recuperación'/);
});
test('writes reports as UTF-8 without BOM and avoids user-supplied paths in logs',()=>{
  assert.match(script,/\[System\.Text\.UTF8Encoding\]::new\(\$false\)/);
  assert.match(script,/\[System\.IO\.File\]::WriteAllText/);
  assert.match(script,/New-Item -Path \$session -ItemType Directory -ErrorAction Stop/);
  assert.doesNotMatch(script, /ConvertTo-Json.*manifest/i);
});

test('never put sensitive customer originals inside git checkout or Windows junction',()=>{
  assert.match(script,/repoCanonical/);
  assert.match(script,/destinationCanonical/);
  assert.match(script,/StartsWith\(\$repoCanonical/);
  assert.match(script,/FileAttributes\]::ReparsePoint/);
  assert.match(script,/SecureRoot NO puede estar dentro del repositorio/);
});
