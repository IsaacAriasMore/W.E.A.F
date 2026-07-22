export default {
  common: {
    yes: 'Yes', no: 'No', all: 'All', loading: 'Loading…', signIn: 'Sign in', signUp: 'Sign up',
    signOut: 'Sign out', myTribe: 'My tribe', clear: 'Clear', optional: 'optional', language: 'Language',
    edit: 'Edit', saveChanges: 'Save changes', website: 'Website', back: 'Back', new: 'New', verified: 'Verified',
  },
  nav: { home: 'Home', inis: 'INIs', mapsBosses: 'Maps & Bosses', creatures: 'Creatures', servers: 'Servers', menuOpen: 'Open menu', menuClose: 'Close menu' },
  home: {
    hero: {
      eyebrow: 'Coordination for tribes', title: 'Turn progress into a shared plan.',
      subtitle: 'Public tools and private spaces to organize creatures, mutations, bosses, INIs, and servers across ASE and ASA.',
      primary: 'Create account', secondary: 'Explore INIs', servers: 'View servers',
    },
    scroll: 'Explore', heroAlt: 'Prehistoric creatures cross a volcanic plateau at sunrise', heroCaption: 'Plan. Breed. Progress.',
    tools: {
      title: 'Useful tools from the first minute.', body: 'Browse configurations, prepare bosses, and find creatures or servers without creating an account.',
      inisTitle: 'INIs ready to copy', inisBody: 'Filter by goal and download a clean configuration.', inisLink: 'Open library',
      bossesTitle: 'Maps & Bosses', bossesBody: 'Track tributes by map, boss, and difficulty.', bossesLink: 'Prepare battle',
      creaturesTitle: 'Creature library', creaturesBody: 'Find species by game, map, and role.', creaturesLink: 'Explore creatures',
      serversTitle: 'Featured servers', serversBody: 'Compare maps, rates, platforms, and play style.', serversLink: 'View servers',
    },
    private: {
      title: 'Your tribe, its private space.', body: 'Invite members, assign roles, and coordinate breeds, mutations, and Discord alerts without exposing progress.',
      roles: 'Clear roles', rolesValue: 'owner / admin / member', breeds: 'Breeds and mutations', breedsValue: 'isolated by tribe', discord: 'Discord', discordValue: 'alerts with a private webhook',
    },
    games: {
      title: 'ASE and ASA from day one.', body: 'The catalog keeps each game context separate and filters compatible content.',
      evolved: 'Evolved', evolvedBody: 'Established catalog, classic maps, and mature configurations.', both: 'Both', bothBody: 'Goals, coordination, and privacy with the right context.', ascended: 'Ascended', ascendedBody: 'Compatible content and a catalog ready to grow.',
    },
    breeding: {
      title: 'Propagators or vanilla breeding.', body: 'Configure cooldowns or multipliers and turn every pairing into a visible tribe task.',
      imageAlt: 'Prehistoric creatures in the original W.E.A.F environment', propagators: 'With propagators', cooldown: 'Configurable cooldown', vanilla: 'Vanilla breeding', multipliers: 'Multipliers and real timing',
    },
    servers: { title: 'Community featured servers.', body: 'Compare maps, platforms, rates, and mods before joining.', view: 'View servers', publish: 'List my server' },
    steps: { title: 'From account to first breed.', account: 'Create your account', tribe: 'Create or join a tribe', config: 'Configure game and Discord', breeds: 'Organize your breeds', alerts: 'Receive alerts and share progress' },
    community: { title: 'Built for communities.', body: 'W.E.A.F is an independent tool for tribes, breeders, and server owners.', independent: 'This is not an official app.', independentBody: 'Its independent status is documented and visible on every page.' },
    faq: {
      title: 'Frequently asked questions',
      q1: 'Do I need an account to use INIs?', a1: 'No. Public tools can be used without signing in.',
      q2: 'Are breeds public?', a2: 'No. Breeds, mutations, and activity belong to each tribe’s private space.',
      q3: 'Can I use it for ASA?', a3: 'Yes. W.E.A.F separates content for ASE, ASA, or both.',
      q4: 'Is the Discord webhook private?', a4: 'Yes. The URL is stored for the tribe and is never shown on public pages.',
      q5: 'Can I list my server?', a5: 'Yes. Choose a monthly Normal or Plus plan and complete payment through Stripe.',
      q6: 'Is W.E.A.F affiliated with ARK or Wildcard?', a6: 'No. It is an independent tool built for the community.',
    },
    featuredEmpty: { title: 'The showcase is ready.', body: 'Plus servers will appear here after Stripe confirms their subscription.' },
    final: { title: 'Organize your next breeding line with your tribe.', servers: 'Explore servers' },
  },
  servers: {
    publish: 'List your server', maps: 'Available maps', mapsHelp: 'Select every map your server has.',
    platforms: 'Available platforms', platformsHelp: 'Select every platform players can use to join your server.',
    modsQuestion: 'Does it use mods?', rates: 'Server rates', ratesHelp: 'Rates are server multipliers. For example, 5x means five times faster than vanilla/official.',
    unsure: "I'm not sure / Do not specify", vanilla: 'Vanilla / Official', custom: 'Custom', checkout: 'Continue to payment',
    paymentReceived: 'Payment received', paymentCanceled: 'Payment canceled', billing: 'Manage billing', featured: 'Featured server',
    mods: 'Mods', noSpecification: 'Not specified', available: 'Available servers', empty: 'We did not find a match.',
    low: 'Low', medium: 'Medium', high: 'High', configuration: 'Configuration', modsHelp: 'We only need to know whether the server uses mods.',
    directory: {
      eyebrow: 'Community directory', title: 'Find a server with your rules.', gameCoverage: 'ASE + ASA', directInfo: 'Direct information', noRankings: 'No artificial rankings',
      filters: 'Server filters', filter: 'Filter', game: 'Game', mode: 'Mode', withMods: 'With mods', withoutMods: 'Without mods', platform: 'Platform', console: 'Console', region: 'Region', regionExample: 'e.g. LATAM', language: 'Language', languageExample: 'e.g. English', cluster: 'Cluster', propagators: 'Propagators', searching: 'Searching servers…', howItWorks: 'See how it works', emptyHelp: 'Try a broader region or clear the filters.', one: '{count} server', many: '{count} servers', discord: 'Join Discord', website: 'Website', wipe: 'Wipe', verified: 'Verified', new: 'New',
    },
    owner: {
      back: 'Back to directory', eyebrow: 'For server owners', title: 'List with control and transparent billing.', body: 'Choose Normal or Plus, complete the listing, and activate it through Stripe Checkout.', viewPlans: 'View plans', plansLabel: 'Server listing plans', essential: 'Essential base', visibility: 'More visibility', normalBody: 'A clear, stable presence in the directory.', plusBody: 'Built for seasons, wipes, and launches.', perMonth: 'USD / month', choose: 'Choose {plan}',
      normalFeatures: 'Full listing|Edit while active|Click analytics', plusFeatures: 'Everything in Normal|Featured placement|Featured badge',
      processTitle: 'A short, transparent flow.', step1: 'Choose reach', step1Body: 'Normal for a stable presence; Plus to stand out.', step2: 'Complete the listing', step2Body: 'Maps, platforms, rates, and links are saved as a draft.', step3: 'Confirm payment', step3Body: 'Stripe processes the subscription and a signed webhook activates the listing.', policyBefore: 'Listings must follow the', policyLink: 'server policy', policyAfter: 'The team may pause misleading or unsafe content.',
    },
    form: {
      editEyebrow: 'Edit listing', newEyebrow: 'New listing', activeUntil: 'Active until {date}', activeNotice: 'new notice', paymentGate: 'The listing activates only after Stripe confirms payment.', basic: 'Basic information', name: 'Server name', nameExample: 'e.g. Southern Forge', description: 'Description', descriptionExample: 'Explain the server style, rules, and community.', game: 'Game', mode: 'Mode', region: 'Region', language: 'Language', discord: 'Discord', website: 'Website (optional)', banner: 'Original or licensed banner (optional)', details: 'Additional details', cluster: 'Cluster (optional)', wipe: 'Last wipe (optional)', propagators: 'This server uses propagators', immediate: 'Changes are published immediately.', redirectStripe: 'You will be redirected to Stripe Checkout.', adminPending: 'It will be saved pending administrative activation.', saveDraft: 'Save draft',
      noneTitle: 'You do not have any listings yet.', noneBody: 'Choose Normal or Plus, complete the listing, and continue to secure payment.', viewPlans: 'View plans', yours: 'Your listings', yoursBody: 'Check status, edit details, or manage the subscription.', newListing: 'New listing', selectorEyebrow: 'Choose how to appear', selectorTitle: 'Select a plan to begin.', selectorBody: 'You can review the full listing before opening Stripe Checkout.', normalBody: 'Full listing and editing while active.', plusBody: 'Featured placement and Plus badge.', plansBack: 'Plans', accountEyebrow: 'Server account', pageTitle: 'List with clear information.', loading: 'Loading your listings…', accountError: 'We could not open your account.', unavailable: 'Listing unavailable.', ownershipError: 'You can only edit listings that belong to you.', openingStripe: 'Opening Stripe…', choicesError: 'Select at least one map and one platform.', saved: 'Changes published.', draftSaved: 'Draft saved. Activation will be handled administratively.',
      statusCanceling: 'Cancellation scheduled', statusActive: 'Active', statusCanceled: 'Canceled', statusPaused: 'Paused', statusExpired: 'Expired', statusPending: 'Payment pending', statusDraft: 'Draft', statusHidden: 'Hidden', statusRejected: 'Rejected', statusUnknown: 'No status',
    },
    result: {
      canceled: 'Payment canceled', noCharge: 'No new charge was made.', saved: 'Your listing was saved and will remain private until Stripe confirms a payment.', back: 'Back to listing', plans: 'View plans', received: 'Payment received', confirming: 'We are confirming your subscription.', webhook: 'The listing will activate after the signed Stripe webhook arrives.', active: 'Active subscription', published: '{title} is now published.', validUntil: 'Plan {plan} is active until {date}.', directory: 'View in directory', billing: 'Manage billing', statusError: 'We could not check the status.', pending: 'Confirmation pending', delayed: 'Stripe has not sent the webhook yet.', delayedBody: 'Do not pay again. Check this page again in a moment.', myListings: 'View my listings.',
    },
  },
  legal: {
    eyebrow: 'Preliminary document', version: 'Preliminary version: July 21, 2026', noticeTitle: 'Pending professional review', noticeBody: 'This text is an informational baseline, not final legal advice. It must be reviewed before commercial launch.', documents: 'Documents', aria: 'Legal documents', terms: 'Terms', privacy: 'Privacy', cookies: 'Cookies', disclaimer: 'Disclaimer', refunds: 'Refunds', servers: 'Servers', report: 'Report', contact: 'Contact',
  },
  inis: {
    eyebrow: 'Public library', title: 'Review INIs before you copy them.', body: 'Starter configurations for ASE and ASA. Review every value for your version, platform, and hardware before applying it.', aria: 'INI presets', filters: 'Filter by category', all: 'All', farming: 'Farming', pvp: 'PvP', hard: 'Hard', fps: 'FPS Boost', visibility: 'Visibility', clean: 'Clean', one: '{count} preset available', many: '{count} presets available', preview: '{title} preview', copy: 'Copy', view: 'View INI', download: 'Download', close: 'Close', copyDialog: 'Copy INI', copied: 'INI copied to the clipboard.', copyError: 'Could not copy it. Select the content manually.', downloadReady: 'Download ready.',
  },
  creatures: {
    eyebrow: 'Public library', title: 'Find the creature that fits the plan.', body: 'Filter by game, type, map, or role. Times are initial references and may vary by version or configuration.', cards: 'starter entries', filters: 'Library filters', search: 'Search creature', searchExample: 'e.g. Rex', game: 'Game', type: 'Type', map: 'Map', use: 'Role', both: 'Both', cooldown: 'Vanilla cooldown', art: 'Original, unofficial concept art.', emptyTitle: 'We could not find that combination.', emptyBody: 'Try another game, map, or search term.', clear: 'Clear filters', one: '{count} creature found', many: '{count} creatures found', image: 'Original illustration of {name}',
  },
  bosses: {
    storageError: 'The browser could not save the checklist.', eyebrow: 'Local preparation', title: 'Do not let the tribute be the surprise.', body: 'Choose a map, boss, and difficulty. Mark what your tribe already has.', local: 'Saved locally', localBody: 'The checklist stays only in this browser.', encounter: 'Select encounter', map: 'Map', boss: 'Boss', difficulty: 'Difficulty', requirements: 'Required tributes', clear: 'Clear selection', callout: 'Checklist ready. Strategy in context.', calloutBody: 'This community reference is not exhaustive. Confirm tributes, quantities, and strategy for your server version.', creatures: 'Find creatures', imageAlt: 'Original prehistoric landscape used as a visual reference', preparation: 'Suggested preparation', progress: '{complete} of {total} ready', cleared: 'Checklist cleared.',
  },
  footer: {
    tagline: 'Tools to prepare, breed, and progress with your tribe.', creator: 'Creator',
    terms: 'Terms', privacy: 'Privacy', cookies: 'Cookies', disclaimer: 'Disclaimer', contact: 'Contact',
    preferences: 'Privacy preferences', install: 'Install W.E.A.F',
    legal: 'W.E.A.F is an independent community tool. It is not affiliated with or endorsed by Studio Wildcard, Snail Games, ARK: Survival Evolved, or ARK: Survival Ascended.',
  },
};
