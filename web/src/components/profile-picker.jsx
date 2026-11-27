import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Radio, Trash2 } from 'lucide-react';
import { Button, Dialog, Input, Select } from './ui';
import { beforeProfileChange } from '../hooks/use-studio-profile';
import './profile-picker.css';

function ProfileConfirmation({ confirmation, connected, online, busy, onCancel, onConfirm }) {
  const titleId = useId();
  const messageId = useId();
  const cancelButton = useRef(null);
  const deleting = confirmation.action === 'delete';

  useEffect(() => {
    const opener = document.activeElement;
    cancelButton.current?.focus();
    return () => { if (opener?.isConnected) opener.focus(); };
  }, []);

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
    if (event.key === 'Tab') {
      const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
      const edge = event.shiftKey ? buttons[0] : buttons.at(-1);
      if (!edge || edge === document.activeElement) {
        event.preventDefault();
        const next = event.shiftKey ? buttons.at(-1) : buttons[0];
        next?.focus();
      }
    }
  }

  return <Dialog open onClose={onCancel} className="profile-confirmation" backdropClassName="profile-confirmation-backdrop"
    role="alertdialog" aria-labelledby={titleId} aria-describedby={messageId} aria-busy={busy || undefined} onKeyDown={onKeyDown}>
    <span className="profile-confirmation-icon" data-destructive={deleting || undefined} aria-hidden="true">
      {deleting ? <Trash2 size={20}/> : <Radio size={20}/>}
    </span>
    <h2 id={titleId}>{deleting ? 'Eliminar ' : 'Cambiar a '}{confirmation.name}</h2>
    <p id={messageId}>
      {deleting ? 'Volverás a Principal y se conservará una copia de recuperación.' : 'Al cambiar de perfil se cerrará cualquier conexión activa al directo.'}
      {deleting && connected && ' Se desconectará el directo actual.'}
    </p>
    <div className="profile-confirmation-actions">
      <Button ref={cancelButton} variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button>
      <Button variant={deleting ? 'destructive' : 'default'} disabled={!online || busy} onClick={onConfirm}>
        {busy ? 'Procesando…' : deleting ? 'Eliminar perfil' : 'Cambiar de perfil'}
      </Button>
    </div>
  </Dialog>;
}

export function ProfilePicker({ profiles, online, connected, api, notice, dialogRoot }) {
  const selectId = useId();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const canDelete = profiles.activeId !== 'default';

  function canChangeProfile() {
    if (busy || !online) return false;
    if (!window.dispatchEvent(new Event(beforeProfileChange, { cancelable: true }))) {
      notice('Guarda los cambios pendientes antes de cambiar o eliminar el perfil.', { type: 'warning' });
      return false;
    }
    return true;
  }

  function activate(event) {
    const id = event.target.value;
    if (id === profiles.activeId) return;
    if (connected) {
      if (canChangeProfile()) setConfirmation({ action: 'activate', id, name: profiles.items.find(profile => profile.id === id).name });
    } else {
      void applyChange('activate', id);
    }
  }

  function remove() {
    if (!canDelete || !canChangeProfile()) return;
    const { id, name: profileName } = profiles.items.find(profile => profile.id === profiles.activeId);
    setConfirmation({ action: 'delete', id, name: profileName });
  }

  async function applyChange(action, id) {
    if (!canChangeProfile()) return;
    setBusy(true);
    try {
      if (await api('profiles/' + action, { id })) setConfirmation(null);
    } finally { setBusy(false); }
  }

  async function create(event) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      if (await api('profiles/create', { name })) {
        setName('');
        setCreating(false);
      }
    } finally { setBusy(false); }
  }

  return <section className="workspace profile-picker" aria-label="Perfiles locales">
    <label htmlFor={selectId}>Perfil local</label>
    <div className="profile-picker-row">
      <Select id={selectId} value={profiles.activeId} disabled={!online || busy} onChange={activate}>
        {profiles.items.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
      </Select>
      <Button variant="outline" size="icon" aria-label="Nuevo perfil" title="Nuevo perfil" aria-expanded={creating}
        disabled={!online || busy} onClick={() => setCreating(value => !value)}><Plus size={16}/></Button>
      <Button variant="destructive" size="icon" aria-label="Eliminar perfil"
        title={canDelete ? 'Eliminar perfil activo' : 'El perfil Principal está protegido'}
        disabled={!online || busy || !canDelete} onClick={remove}><Trash2 size={16}/></Button>
    </div>
    {creating && <form className="profile-picker-form" onSubmit={create}>
      <Input aria-label="Nombre del perfil" placeholder="Nombre del perfil" value={name} maxLength={60} required autoFocus
        disabled={!online || busy} onChange={event => setName(event.target.value)}/>
      <Button type="submit" size="sm" disabled={!online || busy || !name.trim()}>Crear perfil</Button>
    </form>}
    {confirmation && createPortal(<ProfileConfirmation confirmation={confirmation} connected={connected} online={online} busy={busy}
      onCancel={() => { if (!busy) setConfirmation(null); }} onConfirm={() => applyChange(confirmation.action, confirmation.id)}/>, dialogRoot.current)}
  </section>;
}
