import { Http } from "@yandex-cloud/function-types/dist/src/http";
/**
 * Woof! The ultimate invocation sniffer. Inspecting event and context bones.
 * @param {Object} event - The juicy data pack dropped by the cloud.
 * @param {Object} context - The environment scent of our function backyard.
 * @returns {Object} The exact trail we successfully tracked.
 */
function getInvocationSource(event: Http.Event) {
    // Grrr! If the bone is hollow or has no message meat, it's a stranger!
    if (!event || !('messages' in event)) return { source: 'other', type: 'UNKNOWN', id: null };
    const msgs = event.messages;
    if (!Array.isArray(msgs) || msgs.length === 0) return { source: 'other', type: 'UNKNOWN', id: null };

    const firstMsg = msgs[0];

    // Bark! Checking the passport for the official Timer breed tag
    if (firstMsg.event_metadata?.event_type === 'yandex.cloud.events.serverless.triggers.TimerMessage') return {
        source: 'trigger',
        type: 'TIMER',
        id: firstMsg.details?.trigger_id || null // Grab the trigger ID in our teeth and run!
    };

    // Sniff-sniff... Smells like money! We found the Budget trail!
    if (firstMsg.budget_id && firstMsg.billing_account_id) return {
        source: 'trigger',
        type: 'BUDGET',
        id: firstMsg.budget_id // Budget ID acts as our unique target marker here!
    };

    // If the trail goes cold, wag the tail and return unknown
    return { source: 'other', type: 'UNKNOWN', id: null };
}

export { getInvocationSource }