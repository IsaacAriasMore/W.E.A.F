import { friendlyEdgeFunctionError } from '../utils/edgeFunctionErrors.js';

const messages = {
  global_admin_required: 'Esta cuenta no tiene autoridad global.',
  cannot_suspend_self: 'No puedes suspender tu propia cuenta.',
  user_not_found: 'El usuario ya no existe.',
  tribe_not_found: 'La tribu ya no existe.',
  content_not_found: 'El contenido ya no existe.',
  invalid_content_payload: 'Revisa los datos del contenido.',
  invalid_map_payload: 'Revisa los datos del mapa.',
  invalid_boss_payload: 'Revisa los datos del boss.',
  invalid_requirement_payload: 'Revisa la dificultad, artefactos y tributos.',
  invalid_ini_payload: 'Revisa el contenido y los metadatos del preset INI.',
  unsupported_content_entity: 'Ese tipo de contenido no está habilitado.',
  invalid_feature_flag: 'La clave del flag no es válida.',
  invalid_legal_document: 'El documento legal está incompleto.',
  invalid_listing_payload: 'Revisa los datos obligatorios del servidor.',
  invalid_listing_duration: 'La duración debe ser 1, 3, 9 o 12 meses.',
  listing_slug_taken: 'Ese slug ya pertenece a otro servidor.',
  server_not_found: 'El servidor ya no existe.',
  invalid_offer_payload: 'Revisa precio, descuento, duración y vigencia de la oferta.',
  paypal_plan_not_synced: 'Sincroniza esta versión con PayPal Sandbox antes de publicarla.',
  offer_not_found: 'La oferta ya no existe.',
  invalid_marketplace_report_id: 'El reporte seleccionado no es válido.',
  invalid_marketplace_report_status: 'El estado solicitado para el reporte no es válido.',
  marketplace_report_not_found: 'El reporte ya no existe.',
  authentication_required:
  'Tu sesión expiró. Inicia sesión nuevamente.',

paypal_disabled:
  'PayPal Sandbox está desactivado temporalmente.',

billing_product_missing:
  'No encontramos el producto de facturación de W.E.A.F.',

invalid_plan_version:
  'La versión del plan seleccionada no es válida.',

plan_version_not_found:
  'No encontramos esta versión del plan.',

paypal_product_id_missing:
  'PayPal no devolvió un identificador para el producto.',

paypal_catalog_action_failed:
  'PayPal no pudo completar la sincronización. Inténtalo nuevamente.',
};

function friendly(error, fallback = 'No pudimos completar la acción administrativa.') {
  if (!error) return null;
  const key = Object.keys(messages).find((candidate) => error.message?.includes(candidate));
  return key ? messages[key] : fallback;
}

export function createAdminService(client) {
  const unavailable = { data: null, error: 'Supabase no está conectado.' };
  const rpc = async (name, params = {}, fallback) => {
    if (!client) return unavailable;
    const { data, error } = await client.rpc(name, params);
    return { data, error: friendly(error, fallback) };
  };

  return {
    getWorkspace: () => rpc('get_admin_workspace', {}, 'No pudimos cargar el centro de comando.'),
    getContentWorkspace: () => rpc('get_admin_content_workspace', {}, 'No pudimos cargar el catálogo editorial.'),
    getServerWorkspace: () => rpc('get_admin_server_workspace', {}, 'No pudimos cargar la operación de servidores.'),
    getBillingWorkspace: () => rpc('get_admin_billing_workspace', {}, 'No pudimos cargar planes y ofertas.'),
    getMarketplaceWorkspace: () => rpc('get_admin_marketplace_workspace', {}, 'No pudimos cargar el marketplace.'),
    setUserSuspension: (userId, suspended, reason) => rpc('admin_set_user_suspension', {
      p_user_id: userId, p_suspended: suspended, p_reason: reason || null,
    }),
    setTribeActive: (tribeId, active, reason) => rpc('admin_set_tribe_active', {
      p_tribe_id: tribeId, p_active: active, p_reason: reason || null,
    }),
    upsertContent: (entity, id, payload) => rpc('admin_upsert_content', {
      p_entity: entity, p_id: id || null, p_payload: payload,
    }),
    archiveContent: (entity, id) => rpc('admin_archive_content', { p_entity: entity, p_id: id }),
    upsertMap: (id, payload) => rpc('admin_upsert_map', { p_id: id || null, p_payload: payload }),
    upsertBoss: (id, payload) => rpc('admin_upsert_boss', { p_id: id || null, p_payload: payload }),
    upsertBossRequirement: (id, payload) => rpc('admin_upsert_boss_requirement', { p_id: id || null, p_payload: payload }),
    upsertIniPreset: (id, payload) => rpc('admin_upsert_ini_preset', { p_id: id || null, p_payload: payload }),
    archivePublicContent: (entity, id) => rpc('admin_archive_public_content', { p_entity: entity, p_id: id }),
    setReportStatus: (reportId, status) => rpc('admin_set_report_status', {
      p_report_id: reportId, p_status: status,
    }),
    setFeatureFlag: ({ key, description, enabled, configuration = {} }) => rpc('admin_set_feature_flag', {
      p_key: key, p_description: description || null, p_enabled: enabled, p_configuration: configuration,
    }),
    setAdsPlacement: ({ placement, enabled, provider = 'internal', configuration = {} }) => rpc('admin_set_ads_placement', {
      p_placement: placement, p_enabled: enabled, p_provider: provider, p_configuration: configuration,
    }),
    publishLegal: ({ documentType, version, title, content, publish }) => rpc('admin_publish_legal_document', {
      p_document_type: documentType, p_version: version, p_title: title, p_content: content, p_publish: publish,
    }),
    setServerStatus: ({ listingId, status, featured, verified }) => rpc('admin_set_server_status', {
      p_listing_id: listingId, p_status: status, p_featured: featured, p_verified: verified,
    }),
    upsertServerListing: ({ listingId = null, payload, durationMonths = null }) => rpc('admin_upsert_server_listing', {
      p_listing_id: listingId, p_payload: payload, p_duration_months: durationMonths,
    }),
    renewServerListing: (listingId, durationMonths) => rpc('admin_renew_server_listing', {
      p_listing_id: listingId, p_duration_months: durationMonths,
    }),
    deleteServerListing: (listingId) => rpc('admin_delete_server_listing', { p_listing_id: listingId }),
    saveBillingOffer: (offerId, payload) => rpc('admin_save_billing_offer', { p_offer_id: offerId || null, p_payload: payload }),
    setBillingOfferStatus: (offerId, status) => rpc('admin_set_billing_offer_status', { p_offer_id: offerId, p_status: status }),
    duplicateBillingOffer: (offerId) => rpc('admin_duplicate_billing_offer', { p_offer_id: offerId }),
    setMarketplaceSettings: ({ marketplaceEnabled, paymentsEnabled, priceMinor, currency }) => rpc('admin_set_marketplace_setting', {
      p_marketplace_enabled: marketplaceEnabled, p_payments_enabled: paymentsEnabled,
      p_price_minor: priceMinor, p_currency: currency,
    }),
    moderateMarketplaceListing: (listingId, status, reason) => rpc('admin_moderate_marketplace_listing', {
      p_listing_id: listingId, p_status: status, p_reason: reason || null,
    }),
    updateMarketplaceReportStatus: (reportId, status) => rpc('admin_update_marketplace_report_status', {
      p_report_id: reportId, p_status: status,
    }, 'No pudimos actualizar el reporte del marketplace.'),
    async managePayPalCatalog(action, planVersionId = null) {
  if (!client) return unavailable;

  const { data, error } = await client.functions.invoke(
    'manage-paypal-catalog',
    {
      body: {
        action,
        plan_version_id: planVersionId,
      },
    },
  );

  const friendlyError = await friendlyEdgeFunctionError(
    error,
    data,
    messages,
    'No pudimos sincronizar con PayPal Sandbox.',
  );

  return {
    data,
    error: friendlyError,
  };
},
  };
}
