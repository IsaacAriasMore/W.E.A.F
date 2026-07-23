import { t } from '../../i18n/index.js';
import { createTribeService } from '../../services/tribeService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { setFormStatus, setSubmitting } from '../auth/formUtils.js';

const gameModes = [
  ['evolved', 'ARK: Survival Evolved'],
  ['ascended', 'ARK: Survival Ascended'],
  ['both', 'ARK: Survival Evolved + Ascended'],
];

function formattedDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(value));
}

export function render({ state }) {
  const profile = state.profile || {};
  const email = profile.email || state.session?.user?.email || '';
  const initials = (profile.display_name || email || 'W').slice(0, 1).toUpperCase();

  return `
    <section class="profile-page container reveal-up">
      <header class="profile-heading">
        <div class="profile-avatar media-frame-glow">
          ${profile.avatar_url
            ? `<img src="${escapeHtml(profile.avatar_url)}" width="88" height="88" alt="${t('profile.avatarAlt')}" />`
            : `<span aria-hidden="true">${escapeHtml(initials)}</span>`}
        </div>
        <div>
          <p class="section-kicker">${t('profile.eyebrow')}</p>
          <h1>${t('profile.title')}</h1>
          <p>${t('profile.body')}</p>
        </div>
      </header>

      <div class="profile-layout">
        <form class="profile-form premium-panel-glow" data-profile-form novalidate>
          <div class="profile-form-grid">
            <label>
              <span>${t('profile.email')}</span>
              <input type="email" value="${escapeHtml(email)}" readonly aria-readonly="true" />
              <small>${t('profile.emailHelp')}</small>
            </label>
            <label>
              <span>${t('profile.displayName')}</span>
              <input name="displayName" type="text" minlength="2" maxlength="60" required autocomplete="nickname" value="${escapeHtml(profile.display_name || '')}" />
            </label>
            <label>
              <span>${t('profile.discord')}</span>
              <input name="discordUsername" type="text" maxlength="64" autocomplete="off" placeholder="@survivor" value="${escapeHtml(profile.discord_username || '')}" />
            </label>
            <label>
              <span>${t('profile.avatarUrl')}</span>
              <input name="avatarUrl" type="url" maxlength="500" inputmode="url" placeholder="https://…" value="${escapeHtml(profile.avatar_url || '')}" />
            </label>
            <label class="profile-game-mode">
              <span>${t('profile.gameMode')}</span>
              <select name="gameMode" required>
                ${gameModes.map(([value, label]) => `<option value="${value}" ${profile.default_game_mode === value ? 'selected' : ''}>${label}</option>`).join('')}
              </select>
            </label>
          </div>
          <p class="form-status" data-form-status role="alert" hidden></p>
          <div class="profile-actions">
            <button class="button button-primary" type="submit">${t('common.saveChanges')}</button>
            <a class="button button-secondary" href="/app" data-link>${t('profile.backToTribe')}</a>
          </div>
        </form>

        <aside class="profile-facts premium-panel-glow" aria-label="${t('profile.accountSummary')}">
          <div><span>${t('profile.memberSince')}</span><strong>${escapeHtml(formattedDate(profile.created_at))}</strong></div>
          <div><span>${t('profile.activeTribe')}</span><strong data-profile-active-tribe>${t('common.loading')}</strong></div>
          <div><span>${t('profile.globalRole')}</span><strong>${profile.global_role === 'admin' ? t('profile.roleAdmin') : t('profile.roleUser')}</strong></div>
          <p>${t('profile.securityNote')}</p>
        </aside>
      </div>
    </section>
  `;
}

export function bind({ state, store, profileService, authService }) {
  const form = document.querySelector('[data-profile-form]');
  if (!form) return null;
  const activeTribe = document.querySelector('[data-profile-active-tribe]');
  const tribeService = createTribeService(authService.getClient());
  let alive = true;

  tribeService.listMemberships(state.session.user.id).then(({ data: memberships = [] }) => {
    if (!alive || !activeTribe) return;
    const requestedId = window.localStorage.getItem('weaf:active-tribe');
    const active = memberships.find((membership) => membership.tribe?.id === requestedId) || memberships[0];
    activeTribe.textContent = active?.tribe?.name || t('profile.noActiveTribe');
  });

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormStatus(form);
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    setSubmitting(form, true, t('common.saveChanges'));
    const result = await profileService.updateProfile(state.session.user.id, {
      displayName: values.get('displayName').trim(),
      discordUsername: values.get('discordUsername').trim(),
      avatarUrl: values.get('avatarUrl').trim(),
      gameMode: values.get('gameMode'),
    });
    if (result.error) {
      setFormStatus(form, result.error);
      setSubmitting(form, false, t('common.saveChanges'));
      return;
    }
    store.setState({ profile: result.profile });
    setFormStatus(form, t('profile.saved'), 'success');
    setSubmitting(form, false, t('common.saveChanges'));
  };

  form.addEventListener('submit', onSubmit);
  return () => {
    alive = false;
    form.removeEventListener('submit', onSubmit);
  };
}
