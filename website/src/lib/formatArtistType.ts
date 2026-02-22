const SPECIAL_TYPES: Record<string, string> = {
    "Vocaloid": "VOCALOID",
    "UTAU": "UTAU",
    "SynthesizerV": "Synthesizer V",
    "CeVIO": "CeVIO",
    "NEUTRINO": "NEUTRINO",
    "AIVOICE": "A.I.VOICE",
    "VOICEVOX": "VOICEVOX",
    "NewType": "New Type",
    "Voiceroid": "VOICEROID",
    "ACEVirtualSinger": "ACE Virtual Singer",
    "VoiSona": "VoiSona"
};

export function formatArtistType(artistType: string | null | undefined): string {
    if (!artistType) return '';

    // 1. Check if it is a specifically mapped special case
    if (SPECIAL_TYPES[artistType]) {
        return SPECIAL_TYPES[artistType];
    }

    // 2. Otherwise, split camelCase into spaces as a fallback
    // e.g., "OtherGroup" -> "Other Group", "Producer" -> "Producer"
    return artistType.replace(/([a-z])([A-Z])/g, '$1 $2');
}
