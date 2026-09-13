// icons.js — stroke-style inline SVG icon system + procedural card art. No dependencies, fully offline.
(function (root) {
  const CR = root.CR = root.CR || {};

  const MATURITY_COLORS = {
    driving: '#A7F3D0',
    trending: '#7EA6FF',
    emerging: '#FFCD70',
    signaling: '#A78BFA',
    brewing: '#F59E4A'
  };

  // 24x24 stroke icons (currentColor). Keep each icon <= 4 child nodes (DOM budget, plan note 8).
  const PATHS = {
    'res.money': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M9.2 9.5h4.3a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4.3"/>',
    'res.materials': '<rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="10.5" width="18" height="5" rx="1"/><rect x="3" y="17" width="18" height="4" rx="1"/><path d="M12 4v5M8 10.5v5M16 10.5v5M12 17v4"/>',
    'res.energy': '<path d="M13 2 5 13.5h5.5L9.5 22l8-11.5h-5.5L13 2z"/>',
    'res.research': '<path d="M10 2.5h4M10.5 2.5v5.5l-4.8 9.6A3 3 0 0 0 8.4 21h7.2a3 3 0 0 0 2.7-3.4l-4.8-9.6V2.5"/><path d="M7.2 14.5h9.6"/>',
    'res.morale': '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.6 2.2 4 2.2 4-2.2 4-2.2"/><path d="M9 9.2v.6M15 9.2v.6"/>',
    'res.integrity': '<path d="M14.7 6.3a4.6 4.6 0 0 0-6.1 5.6L3 17.5V21h3.5l5.6-5.6a4.6 4.6 0 0 0 5.6-6.1l-3 3-2.4-.6-.6-2.4 3-3z"/>',

    'cat.economy': '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    'cat.environment': '<path d="M17.5 18a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.2 10.5 4 4 0 0 0 6.5 18h11z"/>',
    'cat.governance': '<path d="M3 21h18M4.5 17.5h15M6.5 17.5v-7M10.2 17.5v-7M13.8 17.5v-7M17.5 17.5v-7"/><path d="M3 10.5 12 3.5l9 7H3z"/>',
    'cat.social': '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.6-4 3.8-6 7.5-6s6.9 2 7.5 6"/>',
    'cat.tech': '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M12 2.5V7M12 17v4.5M2.5 12H7M17 12h4.5M5 5l1.8 1.8M19 19l-1.8-1.8"/>',
    'cat.wellbeing': '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    'cat.venus': '<circle cx="12" cy="10" r="6.5"/><path d="M8.5 21c1.2-1.6 5.8-1.6 7 0"/><path d="M9.2 8.6a3.2 3.2 0 0 1 2.2-1.6"/>',

    'mat.driving': '<path d="M12 3.5 14.6 9l6 .7-4.5 4 1.2 5.9L12 16.4l-5.3 3.2 1.2-5.9-4.5-4 6-.7L12 3.5z"/>',
    'mat.trending': '<path d="M8 5.5 18.5 12 8 18.5v-13z"/>',
    'mat.emerging': '<path d="M12 5.5 20.5 20h-17L12 5.5z"/>',
    'mat.signaling': '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17V3.5z"/>',
    'mat.brewing': '<path d="M16.5 16.5a4 4 0 0 0 .3-7.6A5.5 5.5 0 0 0 5.8 9.7 3.5 3.5 0 0 0 6.2 16.5h10.3z"/><path d="M8.5 20.5h7"/>',

    'action.repair': '<path d="M14.5 3.5 20.5 9.5 18 12l-6-6 2.5-2.5z"/><path d="M12.5 8.5 4 17a2.1 2.1 0 0 0 3 3l8.5-8.5"/>',
    'action.build': '<path d="M3.5 11 12 3.5 20.5 11"/><path d="M6 10v10.5h12V10"/><path d="M12 13v5M9.5 15.5h5"/>',
    'action.turn': '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
    'action.play': '<rect x="3.5" y="6" width="11.5" height="15" rx="2"/><path d="M9 3.5h9.5a2 2 0 0 1 2 2V18"/>',
    'action.restart': '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5v5h5"/>',

    'panel.player': '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.6-4 3.8-6 7.5-6s6.9 2 7.5 6"/>',
    'panel.permanent': '<path d="M12 3l7.5 9L12 21l-7.5-9L12 3z"/>',
    'panel.globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18-3-3.5-3-14.5 0-18z"/>',
    'panel.hand': '<rect x="3.5" y="6" width="11.5" height="15" rx="2"/><path d="M9 3.5h9.5a2 2 0 0 1 2 2V18"/>',
    'panel.log': '<path d="M6.5 3.5h11v17h-11z"/><path d="M9.5 7.5h5M9.5 11h5M9.5 14.5h3.5"/>',
    'panel.threat': '<path d="M12 3.5 21.5 20h-19L12 3.5z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    'panel.rules': '<path d="M4.5 4.5h12a3 3 0 0 1 3 3v12h-12a3 3 0 0 1-3-3v-12z"/><path d="M8.5 8.5h7M8.5 12h7"/>',

    'faction.none': '<path d="M5.5 21V4"/><path d="M5.5 4.5h11.5l-3 3.5 3 3.5H5.5"/>',
    'faction.guild': '<circle cx="12" cy="12" r="8.5"/><path d="M7.5 10.5h8l-2.5-2.5M16.5 13.5h-8l2.5 2.5"/>',
    'faction.covenant': '<path d="M17.5 15a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.2 7.5 4 4 0 0 0 6.5 15h11z"/><path d="M12 15v6.5M12 18.2c-2.2 0-3.8-1.4-3.8-3.2M12 19.8c2.2 0 3.8-1.4 3.8-3.2"/>',
    'faction.technocracy': '<rect x="7.5" y="7.5" width="9" height="9" rx="1.5"/><path d="M10.5 3v4.5M13.5 3v4.5M10.5 16.5V21M13.5 16.5V21M3 10.5h4.5M3 13.5h4.5M16.5 10.5H21M16.5 13.5H21"/><circle cx="12" cy="12" r="1.6"/>',

    'panel.sandbox': '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.2"/><circle cx="15" cy="17" r="2.2"/>', // M3: sliders icon for the sandbox config panel
    'panel.deck': '<rect x="7" y="6.5" width="11" height="14" rx="2"/><path d="M10 3.5h8.5a2 2 0 0 1 2 2V17"/><path d="M10.5 10.5h4M10.5 14h4"/>', // M4: stacked-cards icon for the deck builder
    'panel.tech': '<circle cx="12" cy="12" r="2.6"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(120 12 12)"/>' // M5: atom motif for the tech tree
  };

  function get(name) {
    const body = PATHS[name];
    if (!body) return '';
    return `<svg class="icon icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  function has(name) { return Object.prototype.hasOwnProperty.call(PATHS, name); }

  // ==================== PROCEDURAL CARD ART ====================
  // viewBox 200x56 motif band; card.id seeds an LCG for position/count jitter;
  // stroke color comes from the card's maturity. Pure function of {id, category, maturity}.

  function lcg(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
  }

  function cardArt(card) {
    const color = MATURITY_COLORS[card.maturity] || '#E2E6F0';
    const rnd = lcg(card.id * 2654435761 >>> 0);
    const j = amp => (rnd() - 0.5) * 2 * amp; // jitter in [-amp, amp]
    let inner = '';

    switch (card.category) {
      case 'economy': { // arcs of coins
        const n = 3 + Math.floor(rnd() * 3); // 3-5 coins
        for (let i = 0; i < n; i++) {
          const cx = 40 + i * (120 / Math.max(1, n - 1)) + j(6);
          const cy = 40 - Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 16 + j(4);
          inner += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3" opacity="0.6"/>`;
        }
        break;
      }
      case 'environment': { // clouds
        const n = 2 + Math.floor(rnd() * 2); // 2-3 clouds
        for (let i = 0; i < n; i++) {
          const x = 35 + i * 60 + j(10);
          const y = 20 + i * 10 + j(5);
          inner += `<path d="M${(x + 24).toFixed(1)} ${(y + 14).toFixed(1)}a7 7 0 0 0 .6-13.9 9.5 9.5 0 0 0-18.4 2.4 6.3 6.3 0 0 0 .5 11.5h17.3z" transform="translate(${j(4).toFixed(1)} 0)"/>`;
        }
        break;
      }
      case 'governance': { // columns
        const n = 3;
        for (let i = 0; i < n; i++) {
          const x = 55 + i * 45 + j(4);
          inner += `<path d="M${x.toFixed(1)} 46v-24M${(x - 5).toFixed(1)} 22h10M${(x - 5).toFixed(1)} 46h10"/>`;
        }
        inner += `<path d="M${(45 + j(3)).toFixed(1)} 14h110"/>`;
        break;
      }
      case 'social': { // person figures
        const n = 2 + Math.floor(rnd() * 2); // 2-3 figures
        for (let i = 0; i < n; i++) {
          const cx = 60 + i * 40 + j(8);
          inner += `<circle cx="${cx.toFixed(1)}" cy="18" r="6"/><path d="M${(cx - 11).toFixed(1)} 44c1-9 5.5-13 11-13s10 4 11 13"/>`;
        }
        break;
      }
      case 'tech': { // circuit polyline + nodes
        const pts = [];
        for (let i = 0; i <= 4; i++) pts.push(`${(30 + i * 35 + j(6)).toFixed(1)},${(i % 2 === 0 ? 40 : 16).toFixed(1)}`);
        inner += `<polyline points="${pts.join(' ')}"/>`;
        for (let i = 0; i <= 4; i++) {
          const cx = 30 + i * 35 + j(6);
          const cy = i % 2 === 0 ? 40 : 16;
          inner += `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="3.5"/>`;
        }
        break;
      }
      case 'wellbeing': { // crosses in circles
        const n = 2 + Math.floor(rnd() * 3); // 2-4
        for (let i = 0; i < n; i++) {
          const cx = 50 + i * (100 / Math.max(1, n - 1)) + j(6);
          const cy = 28 + j(8);
          inner += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="10"/><path d="M${cx.toFixed(1)} ${(cy - 5).toFixed(1)}v10M${(cx - 5).toFixed(1)} ${cy.toFixed(1)}h10"/>`;
        }
        break;
      }
      default: { // venus: floating bubbles
        const n = 3 + Math.floor(rnd() * 2); // 3-4 bubbles
        for (let i = 0; i < n; i++) {
          const cx = 40 + i * (120 / Math.max(1, n - 1)) + j(8);
          const cy = 22 + j(10);
          const r = 8 + rnd() * 5;
          inner += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}"/><circle cx="${(cx - r * 0.3).toFixed(1)}" cy="${(cy - r * 0.3).toFixed(1)}" r="${(r * 0.25).toFixed(1)}" opacity="0.6"/>`;
        }
        break;
      }
    }

    return `<svg class="card-art-svg" viewBox="0 0 200 56" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" aria-hidden="true">${inner}</svg>`;
  }

  CR.icons = {
    get,
    has,
    names: Object.keys(PATHS),
    MATURITY_COLORS,
    cardArt
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CR.icons;
})(typeof window !== 'undefined' ? window : globalThis);
