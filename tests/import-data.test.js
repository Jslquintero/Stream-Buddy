import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { importStudioData } from '../backend/import-data.js';
import { StudioProfiles } from '../backend/profiles.js';

test('desktop import preserves profiles, compositions and assets without replacing installed data', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stream-buddy-import-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const previous = path.join(directory, 'previous');
  const profiles = new StudioProfiles(previous);
  profiles.create('Mi directo');
  const id = profiles.state().items.at(-1).id;
  profiles.activate(id);
  const profile = path.join(previous, 'data', 'profiles', id);
  fs.mkdirSync(path.join(profile, 'banner-assets'), { recursive: true });
  fs.writeFileSync(path.join(profile, 'layout-compositions.json'), '{"items":[]}');
  fs.writeFileSync(path.join(profile, 'banner-assets', 'image.png'), 'image bytes');
  fs.writeFileSync(path.join(profile, 'speech.json.wav'), 'temporary');

  const installed = path.join(directory, 'desktop');
  const destination = path.join(installed, 'data');
  fs.mkdirSync(installed);
  importStudioData(installed, previous, destination);
  const imported = new StudioProfiles(installed, { dataDir: destination });
  assert.deepEqual(imported.state(), profiles.state());
  const resource = name => path.join(destination, 'profiles', id, name);
  assert.equal(fs.readFileSync(resource('layout-compositions.json'), 'utf8'), '{"items":[]}');
  assert.equal(fs.readFileSync(resource('banner-assets/image.png'), 'utf8'), 'image bytes');
  assert.equal(fs.existsSync(resource('speech.json.wav')), false);

  profiles.create('Perfil posterior');
  importStudioData(installed, path.join(previous, 'data'), destination);
  assert.deepEqual(new StudioProfiles(installed, { dataDir: destination }).state(), imported.state());
});

test('an invalid legacy profile leaves the installation ready for a retry', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stream-buddy-import-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const previous = path.join(directory, 'previous');
  const installed = path.join(directory, 'desktop');
  const destination = path.join(installed, 'data');
  fs.mkdirSync(previous);
  fs.mkdirSync(installed);
  fs.writeFileSync(path.join(previous, 'profiles.json'), '{}');
  assert.throws(() => importStudioData(installed, previous, destination), /registro de perfiles/);
  assert.deepEqual(fs.readdirSync(installed), []);
});
