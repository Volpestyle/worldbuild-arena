from __future__ import annotations

import random

from worldbuild_api.types import Challenge


_BIOMES_TIER_1 = [
    "volcanic archipelago",
    "subterranean fungal forest",
    "floating desert islands",
    "temperate river-delta megacity",
]

_BIOMES_TIER_2 = [
    "frozen megastructure",
    "storm-wracked salt flats",
    "tidal canyon labyrinth",
    "sunken mangrove basin",
]

_BIOMES_TIER_3 = [
    "underwater city of air-breathers",
    "desert of drifting ice",
    "mountain peak beneath an inland sea",
    "forest that grows only in shadow",
]

_INHABITANTS = [
    "posthuman monks",
    "symbiotic hive-beings",
    "nomadic machine-spirits",
    "amphibious traders",
    "ash-smeared archivists",
    "glass-masked surveyors",
]

_TWISTS_TIER_1 = [
    "light is sacred and rationed",
    "all structures must be temporary",
    "vertical space is status",
    "the founders are still alive but sleeping",
]

_TWISTS_TIER_2 = [
    "fire is forbidden",
    "names are currency and can be stolen",
    "every building must have two exits: one real, one symbolic",
    "timekeeping is illegal; only tides and bells are allowed",
]

_TWISTS_TIER_3 = [
    "inhabitants fear submersion despite living underwater",
    "gravity is a negotiated service, not a constant",
    "speech causes structural decay, so silence is law",
    "the city repels maps; accuracy triggers earthquakes",
]


def generate_challenge(seed: int, tier: int) -> Challenge:
    if tier not in (1, 2, 3):
        raise ValueError("tier must be 1, 2, or 3")

    rng = random.Random(seed)
    biome_pool = {1: _BIOMES_TIER_1, 2: _BIOMES_TIER_2, 3: _BIOMES_TIER_3}[tier]
    twist_pool = {1: _TWISTS_TIER_1, 2: _TWISTS_TIER_2, 3: _TWISTS_TIER_3}[tier]

    return {
        "seed": seed,
        "tier": tier,
        "biome_setting": rng.choice(biome_pool),
        "inhabitants": rng.choice(_INHABITANTS),
        "twist_constraint": rng.choice(twist_pool),
    }

