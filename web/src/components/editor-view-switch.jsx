import { Button } from './ui';

export function EditorViewSwitch({ view, change, editorLabel, monitorLabel }) {
  return <div className="editor-mobile-view" role="group" aria-label="Vista del módulo">
    <Button size="sm" variant="outline" aria-pressed={view === 'editor'} onClick={() => change('editor')}>{editorLabel}</Button>
    <Button size="sm" variant="outline" aria-pressed={view === 'monitor'} onClick={() => change('monitor')}>{monitorLabel}</Button>
  </div>;
}
