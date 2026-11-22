// Voice embeddings published by Kyutai for the Pocket TTS Spanish model.
export const pocketVoices = [
  'lola', 'alba', 'anna', 'azelma', 'bill_boerst', 'caro_davy', 'charles',
  'cosette', 'daan', 'eponine', 'estelle', 'eve', 'fantine', 'george',
  'giovanni', 'jane', 'javert', 'jean', 'juergen', 'marius', 'mary',
  'michael', 'paul', 'peter_yearsley', 'rafael', 'stuart_bell', 'vera',
].map(id => ({
  id,
  name: id.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' '),
}));

export const defaultPocketVoice = pocketVoices[0].id;

export function migrateVoiceEngine(engine) {
  return engine === 'Piper' ? 'PocketTTS' : engine;
}
