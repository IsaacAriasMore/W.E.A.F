import { createAppNavigation } from '../../components/layout/AppNavigation.js';
import { createTribeService } from '../../services/tribeService.js';
import { createTribeStore } from '../../stores/tribeStore.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { showToast } from '../../utils/feedback.js';
import { setFormStatus, setSubmitting } from '../auth/formUtils.js';

const roleLabels = { owner: 'Propietario', admin: 'Admin de tribu', member: 'Miembro' };
const gameLabels = { evolved: 'ASE', ascended: 'ASA', both: 'ASE + ASA' };

function loadingView() {
  return `
    <div class="app-view-loading" aria-label="Cargando espacio privado">
      <span class="skeleton skeleton-copy"></span>
      <span class="skeleton skeleton-title"></span>
      <div><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div>
    </div>
  `;
}

function gatewayView(inviteToken = '', profile = null) {
  return `
    <section class="tribe-gateway">
      <header>
        <p class="section-kicker">Tu espacio privado</p>
        <h1>Funda una tribu o toma tu invitación.</h1>
        <p>Las tribus separan miembros, permisos y datos. Puedes pertenecer a más de una y cambiar entre ellas.</p>
      </header>
      <div class="gateway-columns">
        <form class="gateway-form" data-create-tribe-form novalidate>
          <div><span class="gateway-index">01</span><h2>Crear tribu</h2><p>Quedarás registrado como propietario protegido.</p></div>
          <label><span>Nombre de la tribu</span><input name="name" required minlength="2" maxlength="80" placeholder="Ej. Northern Forge" /></label>
          <label><span>Juego principal</span><select name="gameMode" required>
            <option value="evolved" ${profile?.default_game_mode === 'evolved' ? 'selected' : ''}>ARK: Survival Evolved</option>
            <option value="ascended" ${profile?.default_game_mode === 'ascended' ? 'selected' : ''}>ARK: Survival Ascended</option>
            <option value="both" ${!profile?.default_game_mode || profile.default_game_mode === 'both' ? 'selected' : ''}>Ambos</option>
          </select></label>
          <label><span>Nombre de personaje</span><input name="characterName" required minlength="2" maxlength="80" autocomplete="nickname" /></label>
          <label><span>Steam ID <small>Opcional</small></span><input name="steamId" maxlength="40" inputmode="numeric" /></label>
          <p class="form-status" data-form-status role="alert" hidden></p>
          <button class="button button-primary" type="submit">Crear mi tribu</button>
        </form>
        <form class="gateway-form gateway-form-join" data-join-tribe-form novalidate>
          <div><span class="gateway-index">02</span><h2>Unirme</h2><p>Usa el código privado enviado por un owner o admin.</p></div>
          <label><span>Código de invitación</span><input name="token" required minlength="16" value="${escapeHtml(inviteToken)}" autocomplete="off" /></label>
          <label><span>Nombre de personaje</span><input name="characterName" required minlength="2" maxlength="80" autocomplete="nickname" /></label>
          <label><span>Steam ID <small>Solo si la invitación lo requiere</small></span><input name="steamId" maxlength="40" inputmode="numeric" /></label>
          <p class="form-status" data-form-status role="alert" hidden></p>
          <button class="button button-secondary" type="submit">Validar invitación</button>
        </form>
      </div>
    </section>
  `;
}

function memberActions(member, membership, currentUserId) {
  if (member.user_id === currentUserId || member.role === 'owner') return '';
  const canRemove = membership.role === 'owner' || (membership.role === 'admin' && member.role === 'member');
  if (!canRemove) return '';
  return `
    <div class="member-actions">
      ${membership.role === 'owner' ? `
        <label class="role-select"><span class="sr-only">Rol de ${escapeHtml(member.display_name)}</span>
          <select data-member-role data-user-id="${member.user_id}">
            <option value="member" ${member.role === 'member' ? 'selected' : ''}>Miembro</option>
            <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </label>` : ''}
      <button class="text-button danger-action" type="button" data-remove-member="${member.user_id}">Expulsar</button>
    </div>
  `;
}

function incomingInviteView(inviteToken) {
  if (!inviteToken) return '';
  return `
    <section class="incoming-invite" aria-labelledby="incoming-invite-title">
      <div>
        <p class="section-kicker">Invitación recibida</p>
        <h2 id="incoming-invite-title">Únete a otra tribu</h2>
        <p>Confirma tu identidad de personaje para aceptar este enlace sin abandonar tu tribu actual.</p>
      </div>
      <form data-join-tribe-form novalidate>
        <input name="token" type="hidden" value="${escapeHtml(inviteToken)}" />
        <label><span>Nombre de personaje</span><input name="characterName" required minlength="2" maxlength="80" autocomplete="nickname" /></label>
        <label><span>Steam ID <small>Si la invitación lo requiere</small></span><input name="steamId" maxlength="40" inputmode="numeric" /></label>
        <p class="form-status" data-form-status role="alert" hidden></p>
        <button class="button button-primary" type="submit">Aceptar invitación</button>
      </form>
    </section>
  `;
}

function dashboardView({ memberships, activeMembership, members, invites, currentUserId, inviteToken }) {
  const tribe = activeMembership.tribe;
  const canInvite = ['owner', 'admin'].includes(activeMembership.role);
  return `
    <section class="tribe-dashboard">
      <header class="app-toolbar">
        <div>
          <p class="section-kicker">Centro de tribu</p>
          <h1>${escapeHtml(tribe.name)}</h1>
          <span class="role-badge role-${activeMembership.role}">${roleLabels[activeMembership.role]}</span>
        </div>
        <label class="tribe-switcher"><span>Cambiar de tribu</span><select data-tribe-switcher>
          ${memberships.map((item) => `<option value="${item.tribe_id}" ${item.tribe_id === tribe.id ? 'selected' : ''}>${escapeHtml(item.tribe.name)}</option>`).join('')}
        </select></label>
      </header>
      ${incomingInviteView(inviteToken)}
      <div class="tribe-metrics" aria-label="Resumen de tribu">
        <div><span>Miembros activos</span><strong>${members.length}</strong></div>
        <div><span>Universo</span><strong>${gameLabels[tribe.game_mode]}</strong></div>
        <div><span>Breeds activos</span><strong>0</strong><small>Disponible en Fase 4</small></div>
      </div>
      <div class="tribe-workgrid">
        <section class="member-section">
          <div class="workspace-heading"><div><h2>Miembros</h2><p>Roles separados de la administración global.</p></div></div>
          <div class="member-list">
            ${members.map((member) => `
              <article class="member-row">
                <span class="member-avatar">${escapeHtml(member.display_name || member.character_name || '?').slice(0, 1).toUpperCase()}</span>
                <div class="member-identity"><strong>${escapeHtml(member.display_name)}</strong><span>${escapeHtml(member.character_name || 'Personaje sin definir')}</span></div>
                <span class="role-badge role-${member.role}">${roleLabels[member.role]}</span>
                ${memberActions(member, activeMembership, currentUserId)}
              </article>
            `).join('')}
          </div>
          ${activeMembership.role !== 'owner' ? '<button class="text-button danger-action leave-action" type="button" data-leave-tribe>Abandonar tribu</button>' : ''}
        </section>
        <aside class="invite-section">
          ${canInvite ? `
            <div class="workspace-heading"><div><h2>Invitar</h2><p>El enlace se muestra una sola vez.</p></div></div>
            <form class="invite-form" data-invite-form novalidate>
              <label><span>Invitar mediante</span><select name="targetType" data-invite-target-type><option value="email">Correo</option><option value="steam">Steam ID</option></select></label>
              <label><span data-invite-target-label>Correo del jugador</span><input name="target" type="email" required maxlength="320" /></label>
              <div class="invite-inline">
                <label><span>Rol</span><select name="role"><option value="member">Miembro</option>${activeMembership.role === 'owner' ? '<option value="admin">Admin</option>' : ''}</select></label>
                <label><span>Expira</span><select name="expiresHours"><option value="24">24 horas</option><option value="72" selected>3 días</option><option value="168">7 días</option></select></label>
              </div>
              <p class="form-status" data-form-status role="alert" hidden></p>
              <button class="button button-primary" type="submit">Crear invitación</button>
            </form>
            <div data-invite-result></div>
            ${invites.length ? `<div class="pending-invites"><strong>Pendientes</strong>${invites.map((invite) => `<span>${escapeHtml(invite.invited_email || invite.invited_steam_id)} · ${roleLabels[invite.role]}</span>`).join('')}</div>` : ''}
          ` : `
            <div class="member-permission-note"><span>Acceso de miembro</span><h2>Tu rol es de lectura.</h2><p>Puedes consultar el espacio de la tribu. Las invitaciones y roles dependen de owner y admins.</p></div>
          `}
        </aside>
      </div>
    </section>
  `;
}

export function render({ state }) {
  return `
    <div class="private-app-shell">
      ${createAppNavigation(state.profile)}
      <section class="private-app-main" data-tribe-view>${loadingView()}</section>
    </div>
  `;
}

export function bind({ state, authService, navigate }) {
  const view = document.querySelector('[data-tribe-view]');
  const service = createTribeService(authService.getClient());
  const tribeStore = createTribeStore();

  async function load() {
    view.innerHTML = loadingView();
    const inviteToken = new URLSearchParams(window.location.search).get('invite') || '';
    const membershipsResult = await service.listMemberships(state.session.user.id);
    if (membershipsResult.error) {
      view.innerHTML = `<section class="app-error"><h1>No pudimos abrir tu espacio.</h1><p>${escapeHtml(membershipsResult.error)}</p><button class="button button-primary" data-retry-tribes>Reintentar</button></section>`;
      return;
    }
    tribeStore.setMemberships(membershipsResult.data);
    if (!membershipsResult.data.length) {
      view.innerHTML = gatewayView(inviteToken, state.profile);
      return;
    }

    const requestedId = new URLSearchParams(window.location.search).get('tribe');
    const storedId = tribeStore.getState().activeTribeId;
    const activeMembership = membershipsResult.data.find((item) => item.tribe_id === requestedId)
      || membershipsResult.data.find((item) => item.tribe_id === storedId)
      || membershipsResult.data[0];
    tribeStore.selectTribe(activeMembership.tribe_id);
    const [membersResult, invitesResult] = await Promise.all([
      service.getMembers(activeMembership.tribe_id),
      ['owner', 'admin'].includes(activeMembership.role) ? service.getInvites(activeMembership.tribe_id) : Promise.resolve({ data: [] }),
    ]);
    if (membersResult.error) {
      view.innerHTML = `<section class="app-error"><h1>No pudimos leer esta tribu.</h1><p>${escapeHtml(membersResult.error)}</p><button class="button button-primary" data-retry-tribes>Reintentar</button></section>`;
      return;
    }
    tribeStore.setWorkspace({ members: membersResult.data, invites: invitesResult.data || [] });
    view.innerHTML = dashboardView({
      memberships: membershipsResult.data,
      activeMembership,
      members: membersResult.data,
      invites: invitesResult.data || [],
      currentUserId: state.session.user.id,
      inviteToken,
    });
  }

  const onSubmit = async (event) => {
    const form = event.target.closest('form');
    if (!form) return;
    event.preventDefault();
    setFormStatus(form);
    if (!form.reportValidity()) return;
    const values = new FormData(form);

    if (form.matches('[data-create-tribe-form]')) {
      setSubmitting(form, true, 'Crear mi tribu');
      const result = await service.createTribe({
        name: values.get('name').trim(), gameMode: values.get('gameMode'),
        characterName: values.get('characterName').trim(), steamId: values.get('steamId').trim(),
      });
      if (result.error) { setFormStatus(form, result.error); setSubmitting(form, false, 'Crear mi tribu'); return; }
      navigate(`/app?tribe=${result.data}`);
    }

    if (form.matches('[data-join-tribe-form]')) {
      const submitLabel = form.querySelector('[type="submit"]')?.textContent || 'Aceptar invitación';
      setSubmitting(form, true, submitLabel);
      const result = await service.acceptInvite({
        token: values.get('token').trim(), characterName: values.get('characterName').trim(), steamId: values.get('steamId').trim(),
      });
      if (result.error) { setFormStatus(form, result.error); setSubmitting(form, false, submitLabel); return; }
      navigate(`/app?tribe=${result.data}`);
    }

    if (form.matches('[data-invite-form]')) {
      setSubmitting(form, true, 'Crear invitación');
      const result = await service.createInvite({
        tribeId: tribeStore.getState().activeTribeId,
        targetType: values.get('targetType'), target: values.get('target').trim(),
        role: values.get('role'), expiresHours: values.get('expiresHours'),
      });
      if (result.error) { setFormStatus(form, result.error); setSubmitting(form, false, 'Crear invitación'); return; }
      const inviteUrl = `${window.location.origin}/app?invite=${result.data}`;
      form.reset();
      setSubmitting(form, false, 'Crear invitación');
      document.querySelector('[data-invite-result]').innerHTML = `<div class="invite-result" role="status"><strong>Invitación lista</strong><code>${escapeHtml(inviteUrl)}</code><button class="button button-secondary button-small" type="button" data-copy-invite="${escapeHtml(inviteUrl)}">Copiar enlace</button></div>`;
    }
  };

  const onChange = async (event) => {
    if (event.target.matches('[data-tribe-switcher]')) navigate(`/app?tribe=${event.target.value}`);
    if (event.target.matches('[data-invite-target-type]')) {
      const input = event.target.form.elements.target;
      const email = event.target.value === 'email';
      input.type = email ? 'email' : 'text';
      input.maxLength = email ? 320 : 40;
      document.querySelector('[data-invite-target-label]').textContent = email ? 'Correo del jugador' : 'Steam ID del jugador';
    }
    if (event.target.matches('[data-member-role]')) {
      const result = await service.changeMemberRole({
        tribeId: tribeStore.getState().activeTribeId,
        userId: event.target.dataset.userId,
        role: event.target.value,
      });
      if (result.error) showToast(result.error, 'error');
      else { showToast('Rol actualizado.'); await load(); }
    }
  };

  const onClick = async (event) => {
    if (event.target.closest('[data-retry-tribes]')) load();
    const copy = event.target.closest('[data-copy-invite]');
    if (copy) {
      try {
        await navigator.clipboard.writeText(copy.dataset.copyInvite);
        showToast('Enlace de invitación copiado.');
      } catch {
        showToast('No pudimos copiar el enlace. Selecciónalo manualmente.', 'error');
      }
    }
    const remove = event.target.closest('[data-remove-member]');
    if (remove) {
      if (remove.dataset.confirmed !== 'true') {
        remove.dataset.confirmed = 'true'; remove.textContent = 'Confirmar expulsión';
        window.setTimeout(() => { if (remove.isConnected) { remove.dataset.confirmed = 'false'; remove.textContent = 'Expulsar'; } }, 4000);
        return;
      }
      const result = await service.removeMember({ tribeId: tribeStore.getState().activeTribeId, userId: remove.dataset.removeMember });
      if (result.error) showToast(result.error, 'error'); else { showToast('Miembro retirado.'); await load(); }
    }
    const leave = event.target.closest('[data-leave-tribe]');
    if (leave) {
      if (leave.dataset.confirmed !== 'true') { leave.dataset.confirmed = 'true'; leave.textContent = 'Confirmar que deseo salir'; return; }
      const result = await service.leaveTribe(tribeStore.getState().activeTribeId);
      if (result.error) showToast(result.error, 'error'); else { tribeStore.clear(); navigate('/app'); }
    }
  };

  view.addEventListener('submit', onSubmit);
  view.addEventListener('change', onChange);
  view.addEventListener('click', onClick);
  load();
  return () => {
    view.removeEventListener('submit', onSubmit);
    view.removeEventListener('change', onChange);
    view.removeEventListener('click', onClick);
  };
}
