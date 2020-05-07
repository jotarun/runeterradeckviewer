
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        if (value != null || input.value) {
            input.value = value;
        }
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function beforeUpdate(fn) {
        get_current_component().$$.before_update.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.21.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    class Base32 {
      static numberOfTrailingZeros (i) {
        if (i === 0) return 32
        let n = 31;
        let y = i << 16;
        if (y !== 0) {
          n = n - 16;
          i = y;
        }
        y = i << 8;
        if (y !== 0) {
          n = n - 8;
          i = y;
        }
        y = i << 4;
        if (y !== 0) {
          n = n - 4;
          i = y;
        }
        y = i << 2;
        if (y !== 0) {
          n = n - 2;
          i = y;
        }
        return n - ((i << 1) >> 31)
      }

      static decode (encoded) {
        encoded = encoded.trim().replace(Base32.SEPARATOR, '');
        encoded = encoded.replace(/[=]*$/, '');
        encoded = encoded.toUpperCase();

        if (encoded.length === 0) return [0]
        const encodedLength = encoded.length;
        const outLength = Math.floor(encodedLength * Base32.SHIFT / 8);
        const result = new Array(outLength);
        let buffer = 0;
        let next = 0;
        let bitsLeft = 0;
        for (const c of encoded.split('')) {
          if (typeof Base32.CHAR_MAP[c] === 'undefined') {
            throw new TypeError('Illegal character: ' + c)
          }

          buffer <<= Base32.SHIFT;
          buffer |= Base32.CHAR_MAP[c] & Base32.MASK;
          bitsLeft += Base32.SHIFT;
          if (bitsLeft >= 8) {
            result[next++] = (buffer >> (bitsLeft - 8)) & 0xff;
            bitsLeft -= 8;
          }
        }

        return result
      }

      static encode (data, padOutput = false) {
        if (data.length === 0) return ''
        if (data.length >= (1 << 28)) throw new RangeError('Array is too long for this')

        const outputLength = Math.floor((data.length * 8 + Base32.SHIFT - 1) / Base32.SHIFT);
        const result = new Array(outputLength);

        let buffer = data[0];
        let next = 1;
        let bitsLeft = 8;
        while (bitsLeft > 0 || next < data.length) {
          if (bitsLeft < Base32.SHIFT) {
            if (next < data.length) {
              buffer <<= 8;
              buffer |= (data[next++] & 0xff);
              bitsLeft += 8;
            } else {
              const pad = Base32.SHIFT - bitsLeft;
              buffer <<= pad;
              bitsLeft += pad;
            }
          }
          const index = Base32.MASK & (buffer >> (bitsLeft - Base32.SHIFT));
          bitsLeft -= Base32.SHIFT;
          result.push(Base32.DIGITS[index]);
        }
        if (padOutput) {
          const padding = 8 - (result.length % 8);
          if (padding > 0) result.push('='.repeat(padding === 8 ? 0 : padding));
        }
        return result.join('')
      }
    }

    Base32.DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.split('');
    Base32.MASK = Base32.DIGITS.length - 1;
    Base32.SHIFT = Base32.numberOfTrailingZeros(Base32.DIGITS.length);
    Base32.CHAR_MAP = Base32.DIGITS.reduce((m, d, i) => {
      m[d.toString()] = i;
      return m
    }, {});
    Base32.SEPARATOR = '-';

    var Base32_1 = Base32;

    class VarInt {
      static pop (bytes) {
        let result = 0;
        let currentShift = 0;
        let bytesPopped = 0;
        for (let i = 0; i < bytes.length; i++) {
          bytesPopped++;
          const current = bytes[i] & VarInt.AllButMSB;
          result |= current << currentShift;

          if ((bytes[i] & VarInt.JustMSB) !== VarInt.JustMSB) {
            bytes.splice(0, bytesPopped);
            return result
          }

          currentShift += 7;
        }

        throw new TypeError('Byte array did not contain valid varints.')
      }

      static get (value) {
        const buff = new Array(10);
        buff.fill(0);

        let currentIndex = 0;
        if (value === 0) return [0]

        while (value !== 0) {
          let byteVal = value & VarInt.AllButMSB;
          value >>>= 7;

          if (value !== 0) byteVal |= VarInt.JustMSB;
          buff[currentIndex++] = byteVal;
        }

        return buff.slice(0, currentIndex)
      }
    }

    VarInt.AllButMSB = 0x7f;
    VarInt.JustMSB = 0x80;

    var VarInt_1 = VarInt;

    class Faction {
      constructor (code, id) {
        this.shortCode = code;
        this.id = id;
      }

      static fromCode (code) {
        if (!Faction.FACTIONS.includes(code)) throw new TypeError('Invalid faction code!')
        return new this(code, this.FACTIONS.indexOf(code))
      }

      static fromID (id) {
        return new this(this.FACTIONS[id], id)
      }
    }

    Faction.FACTIONS = ['DE', 'FR', 'IO', 'NX', 'PZ', 'SI', 'BW'];

    var Faction_1 = Faction;

    var Card_1 = class Card {
      constructor (cardCode, count) {
        this.code = cardCode;
        this.count = count;
      }

      static from (setString, factionString, numberString, count) {
        return new this(setString + factionString + numberString, count)
      }

      static fromCardString (cardString) {
        const [count, cardCode] = cardString.split(':');
        return new this(cardCode, parseInt(count))
      }

      get set () {
        return parseInt(this.code.substring(0, 2))
      }

      get faction () {
        return Faction_1.fromCode(this.code.substring(2, 4))
      }

      get id () {
        return parseInt(this.code.substring(4, 7))
      }
    };

    class DeckEncoder {
      static decode (code) {
        const result = [];

        let bytes = null;
        try {
          bytes = Base32_1.decode(code);
        } catch (e) {
          throw new TypeError('Invalid deck code')
        }

        const firstByte = bytes.shift();
        const version = firstByte & 0xF;

        if (version > DeckEncoder.MAX_KNOWN_VERSION) {
          throw new TypeError('The provided code requires a higher version of this library; please update.')
        }

        for (let i = 3; i > 0; i--) {
          const numGroupOfs = VarInt_1.pop(bytes);

          for (let j = 0; j < numGroupOfs; j++) {
            const numOfsInThisGroup = VarInt_1.pop(bytes);
            const set = VarInt_1.pop(bytes);
            const faction = VarInt_1.pop(bytes);

            for (let k = 0; k < numOfsInThisGroup; k++) {
              const card = VarInt_1.pop(bytes);

              const setString = set.toString().padStart(2, '0');
              const factionString = Faction_1.fromID(faction).shortCode;
              const cardString = card.toString().padStart(3, '0');

              result.push(Card_1.from(setString, factionString, cardString, i));
            }
          }
        }

        while (bytes.length > 0) {
          const fourPlusCount = VarInt_1.pop(bytes);
          const fourPlusSet = VarInt_1.pop(bytes);
          const fourPlusFaction = VarInt_1.pop(bytes);
          const fourPlusNumber = VarInt_1.pop(bytes);

          const fourPlusSetString = fourPlusSet.toString().padStart(2, '0');
          const fourPlusFactionString = Faction_1.fromID(fourPlusFaction).shortCode;
          const fourPlusNumberString = fourPlusNumber.toString().padStart(3, '0');

          result.push(Card_1.from(fourPlusSetString, fourPlusFactionString, fourPlusNumberString, fourPlusCount));
        }

        return result
      }

      static encode (cards) {
        if (!this.isValidDeck(cards)) {
          throw new TypeError('The deck provided contains invalid card codes')
        }

        const grouped3 = this.groupByFactionAndSetSorted(cards.filter(c => c.count === 3));
        const grouped2 = this.groupByFactionAndSetSorted(cards.filter(c => c.count === 2));
        const grouped1 = this.groupByFactionAndSetSorted(cards.filter(c => c.count === 1));
        const nOfs = cards.filter(c => c.count > 3);

        return Base32_1.encode([
          0x11,
          ...this.encodeGroup(grouped3),
          ...this.encodeGroup(grouped2),
          ...this.encodeGroup(grouped1),
          ...this.encodeNofs(nOfs)
        ])
      }

      static encodeNofs (nOfs) {
        return nOfs
          .sort((a, b) => a.code.localeCompare(b.code))
          .reduce((result, card) => {
            result.push(...VarInt_1.get(card.count));
            result.push(...VarInt_1.get(card.set));
            result.push(...VarInt_1.get(card.faction.id));
            result.push(...VarInt_1.get(card.id));
            return result
          }, [])
      }

      static encodeGroup (group) {
        return group.reduce((result, list) => {
          result.push(...VarInt_1.get(list.length));

          const first = list[0];
          result.push(...VarInt_1.get(first.set));
          result.push(...VarInt_1.get(first.faction.id));

          for (const card of list) {
            result.push(...VarInt_1.get(card.id));
          }

          return result
        }, VarInt_1.get(group.length))
      }

      static isValidDeck (cards) {
        return cards.every(card => (
          card.code.length === 7 &&
          !isNaN(card.id) &&
          !isNaN(card.count) &&
          card.faction &&
          card.count > 0
        ))
      }

      static groupByFactionAndSetSorted (cards) {
        const result = [];

        while (cards.length > 0) {
          const set = [];

          const first = cards.shift();
          set.push(first);

          for (let i = cards.length - 1; i >= 0; i--) {
            const compare = cards[i];
            if (first.set === compare.set && first.faction.id === compare.faction.id) {
              set.push(compare);
              cards.splice(i, 1);
            }
          }

          result.push(set);
        }

        return result.sort((a, b) => a.length - b.length).map(group => group.sort((a, b) => a.code.localeCompare(b.code)))
      }
    }

    DeckEncoder.MAX_KNOWN_VERSION = 2;

    var DeckEncoder_1 = DeckEncoder;

    var src = {
      DeckEncoder: DeckEncoder_1,
      Card: Card_1,
      Faction: Faction_1
    };
    var src_1 = src.DeckEncoder;

    var set2 = [
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ001-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 5,
    		health: 5,
    		description: "召喚此牌時抽1張牌。\r\n若我方已打出10張以上名稱不重複之卡牌，則賦予此牌+4|+0。<style=Variable></style>",
    		descriptionRaw: "召喚此牌時抽1張牌。\r\n若我方已打出10張以上名稱不重複之卡牌，則賦予此牌+4|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "沒有任何事能阻止他逃離只懂癡笑的人群，只不過是水而已，沒什麼好怕的。",
    		artistName: "SIXMOREVODKA",
    		name: "潛水喵",
    		cardCode: "02PZ001",
    		keywords: [
    			"隱密"
    		],
    		keywordRefs: [
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW040.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW040-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我最擅長命今平民白性，環有從不寫錯字」——寫在沙上的留言",
    		artistName: "Kudos Productions",
    		name: "貝殼電擊者 ",
    		cardCode: "02BW040",
    		keywords: [
    			"調節"
    		],
    		keywordRefs: [
    			"Attune"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR009-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 4,
    		cost: 4,
    		health: 3,
    		description: "：獲得1個魔力寶石槽位。",
    		descriptionRaw: "：獲得1個魔力寶石槽位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "冬之爪部落中，在年輕的劫盜者能夠拿起武器的那一刻，他們便會被分派到一隻幼狼，從此他們會接受訓練，成為戰鬥機器：幼狼學習如何咬斷敵人的喉嚨，而騎手則學習如何劫掠和偷竊。",
    		artistName: "MAR Studio",
    		name: "狂狼騎士",
    		cardCode: "02FR009",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ010-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，所有玩家各抽1張牌。",
    		descriptionRaw: "召喚此牌時，所有玩家各抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "有些探長靠直覺破案，有些則靠線報，不過J·S·哈諾克探長的強項則純粹是靠努力：日夜不停地翻查檔案。",
    		artistName: "SIXMOREVODKA",
    		name: "資深調查組員",
    		cardCode: "02PZ010",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02NX007"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX001-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 5,
    		cost: 8,
    		health: 8,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：抽出1張<link=card.champ1><style=AssociatedCard>斯溫</style></link>。<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：對敵方主堡造成3次1點傷害。",
    		descriptionRaw: "出牌：抽出1張斯溫。回合開始：對敵方主堡造成3次1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "當愛歐尼亞居民看見那東西從地平線出現時，他們以為自己看到了一隻怪物。他們想的也八九不離十了，因為那艘鋼鐵戰艦異常駭人，是諾克薩斯海軍工程史上最驚人的成就。",
    		artistName: "SIXMOREVODKA",
    		name: "海王號",
    		cardCode: "02NX001",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW057.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW057-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 5,
    		health: 4,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「船長，我發誓我在珊瑚礁那邊看到了史上最奇怪的景象！那個笨蛋往橘子裡塞了什麼鬼啊，我一直在想……」——肖狗水手",
    		artistName: "Kudos Productions",
    		name: "狡猾踏浪者",
    		cardCode: "02BW057",
    		keywords: [
    			"隱密",
    			"調節"
    		],
    		keywordRefs: [
    			"Elusive",
    			"Attune"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE003-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 3,
    		health: 4,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "俗語說得好：「主人寵物一個樣」。",
    		artistName: "SIXMOREVODKA",
    		name: "忠心獾熊",
    		cardCode: "02DE003",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI005-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "<link=vocab.Toss><style=Vocab>亂擲</style></link>3張牌。\r\n治癒所有友軍單位3點生命。",
    		descriptionRaw: "亂擲3張牌。\r\n治癒所有友軍單位3點生命。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「島嶼將被淨化。」——茂凱",
    		artistName: "Kudos Productions",
    		name: "魔法樹液",
    		cardCode: "02SI005",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032T3",
    			"02BW032T2",
    			"02BW032T1",
    			"02BW032T4"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW032.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW032-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 5,
    		cost: 5,
    		health: 5,
    		description: "召喚此牌時，召喚1個<link=card.summon><style=AssociatedCard>火藥桶</style></link>。",
    		descriptionRaw: "召喚此牌時，召喚1個火藥桶。",
    		levelupDescription: "我方在本牌局對敵方主堡造成傷害累計5回合<style=Variable></style>。",
    		levelupDescriptionRaw: "我方在本牌局對敵方主堡造成傷害累計5回合。",
    		flavorText: "「不要瞪太久，不然會被他發現；不要說他壞話，比爾吉沃特任何風聲都逃不過他的耳朵。他來了，快低下頭，盯著地上。」——恐懼號水手",
    		artistName: "SIXMOREVODKA",
    		name: "剛普朗克",
    		cardCode: "02BW032",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW041.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW041-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 4,
    		health: 4,
    		description: "<style=Variable></style>",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「無需害怕可厭野獸，\n因尚有人獲得救助，\n畏懼那些撞裂船頭，\n拉人入深淵的怪物。」\n——潦草刻在某間比爾吉沃特酒館屋樑上的歌謠",
    		artistName: "SIXMOREVODKA",
    		name: "深海巨怪",
    		cardCode: "02BW041",
    		keywords: [
    			"探底"
    		],
    		keywordRefs: [
    			"Deep"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "海怪",
    		subtypes: [
    			"海怪"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032",
    			"02BW032T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW032T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW032T2-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "對任一目標造成1點傷害。\r\n若擊殺該單位，則另外對敵方主堡造成1點傷害。\r\n將1張<link=card.level1><style=AssociatedCard>剛普朗克</style></link>洗入我方牌組。",
    		descriptionRaw: "對任一目標造成1點傷害。\r\n若擊殺該單位，則另外對敵方主堡造成1點傷害。\r\n將1張剛普朗克洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "剛普朗克的談判過程通常都很短，不過必定見血。",
    		artistName: "Kudos Productions",
    		name: "剛普朗克 槍火談判",
    		cardCode: "02BW032T2",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ006-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "抽到此牌時，此牌本回合魔耗值-2。\r\n對1個單位造成3點傷害。",
    		descriptionRaw: "抽到此牌時，此牌本回合魔耗值-2。\r\n對1個單位造成3點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「伯茲先生，可以麻煩你試試戴上這些手銬嗎？」\n「這對我有什麼好處？」\n「我會把它送給你當禮物。」\n「……那好吧。」\n「你被逮捕了！來人，把他帶走！」",
    		artistName: "Max Grecke",
    		name: "逮到你囉！",
    		cardCode: "02PZ006",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW013.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW013-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「然後那傻子就誇我有個『適合翻雲覆雨的臀』，我便跟他說再不停下花言巧語我就割下他的舌頭。」",
    		artistName: "SIXMOREVODKA",
    		name: "潛行割喉者",
    		cardCode: "02BW013",
    		keywords: [
    			"威嚇",
    			"隱密"
    		],
    		keywordRefs: [
    			"Fearsome",
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI010-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "召喚此牌時，<link=vocab.Toss><style=Vocab>亂擲</style></link>3張牌。",
    		descriptionRaw: "召喚此牌時，亂擲3張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「偉大的樹人不斷展示……生物。這隻生物……她所到之處必有生命……十分驚人……這個地方。天堂島名非虛傳！」——拼湊起來的無名日記",
    		artistName: "Slawomir Maniak",
    		name: "死花漫遊者",
    		cardCode: "02SI010",
    		keywords: [
    			"吸血"
    		],
    		keywordRefs: [
    			"Lifesteal"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW034T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW034T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：對敵方主堡造成1點傷害。",
    		descriptionRaw: "遺願：對敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「真是一群調皮鬼，你說是吧？其實他們還挺幫得上忙的，只不過有人說他們脾氣火爆……」——賽蓮號水手",
    		artistName: "Kudos Productions",
    		name: "火藥猴群",
    		cardCode: "02BW034T1",
    		keywords: [
    			"閃靈",
    			"遺願"
    		],
    		keywordRefs: [
    			"Ephemeral",
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW056T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW056T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "<link=keyword.Obliterate><style=Keyword>泯滅</style></link>1個生命值低於此牌的敵軍單位。",
    		descriptionRaw: "泯滅1個生命值低於此牌的敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「她將我人船併吞，\n使我在肚裡受困。\n現在我只能高歌，\n自己的命運坎坷。」——〈翼耳深海女王民謠〉",
    		artistName: "Kudos Productions",
    		name: "大快朵頤",
    		cardCode: "02BW056T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW061.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW061-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "抽到此牌時，此牌本回合魔耗值-1。\r\n賦予1個友軍單位+2|+1。",
    		descriptionRaw: "抽到此牌時，此牌本回合魔耗值-1。\r\n賦予1個友軍單位+2|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「手氣夠好，籌碼滾滾來。」——逆命",
    		artistName: "Kudos Production",
    		name: "祕密王牌",
    		cardCode: "02BW061",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW060T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW060.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW060-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "友軍攻擊時，對敵方主堡造成1點傷害。",
    		descriptionRaw: "友軍攻擊時，對敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「人矮有其好處，打架時沒有人會留意下方。」",
    		artistName: "SIXMOREVODKA",
    		name: "神射海盜",
    		cardCode: "02BW060",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02NX007",
    			"02NX007T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX007T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX007T2-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 4,
    		cost: 5,
    		health: 7,
    		description: "當敵方主堡受到非戰鬥傷害時，<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>敵方後排<link=vocab.Strongest><style=Vocab>最強</style></link>的敵軍。\r\n<link=vocab.Nexus Strike><style=Vocab>打擊主堡</style></link>：對所有敵軍單位造成3點傷害。",
    		descriptionRaw: "當敵方主堡受到非戰鬥傷害時，擊暈敵方後排最強的敵軍。\r\n打擊主堡：對所有敵軍單位造成3點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「為了打下諾克薩斯的江山，任何犧牲都在所不惜。」 ",
    		artistName: "SIXMOREVODKA",
    		name: "斯溫",
    		cardCode: "02NX007T2",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW022",
    			"02BW022T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW022T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW022T3-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "隨機對3名敵軍單位造成1點傷害。\r\n將1張<link=card.level1><style=AssociatedCard>好運姐</style></link>洗入我方牌組。",
    		descriptionRaw: "隨機對3名敵軍單位造成1點傷害。\r\n將1張好運姐洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「火力全開！」——好運姐",
    		artistName: "Kudos Productions",
    		name: "好運姐 槍林彈雨",
    		cardCode: "02BW022T3",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW020"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW011-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "召喚此牌時，在手牌生成1張<link=card.create><style=AssociatedCard>警告射擊</style></link>。\r\n<link=vocab.Allegiance><style=Vocab>效忠</style></link>：從敵方牌組抽1張牌。",
    		descriptionRaw: "召喚此牌時，在手牌生成1張警告射擊。\r\n效忠：從敵方牌組抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你懂得，朋友就是要互相幫忙。至於你嘛？我喜歡你雙眼炯炯有神，還有那把閃亮亮的水手刀，那可真是一柄好刀！」",
    		artistName: "SIXMOREVODKA",
    		name: "約德爾騙子",
    		cardCode: "02BW011",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW022T1",
    			"02BW022T4",
    			"02BW022T2",
    			"02BW022T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW022-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "友軍單位攻擊時，對戰鬥中敵軍單位與敵方主堡造成1點傷害。",
    		descriptionRaw: "友軍單位攻擊時，對戰鬥中敵軍單位與敵方主堡造成1點傷害。",
    		levelupDescription: "此牌在場上時我方攻擊4次<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌在場上時我方攻擊4次。",
    		flavorText: "「你叫我好運姐？在外頭你得稱我一聲『船長』。」",
    		artistName: "SIXMOREVODKA",
    		name: "好運姐",
    		cardCode: "02BW022",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW030T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW030T2-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "此牌遭到<link=vocab.Toss><style=Vocab>亂擲</style></link>時，反而會被抽出。\r\n對所有單位造成5點傷害。",
    		descriptionRaw: "此牌遭到亂擲時，反而會被抽出。\r\n對所有單位造成5點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "甲板上的水手齊聲吶喊，用力拉起絞鏈，寶藏就在平靜海面的咫尺之下了。他們沒料到的是，傳說中綠淵號的大砲還有最後一發沒有用罄。",
    		artistName: "Kudos Productions",
    		name: "龍骨破壞者",
    		cardCode: "02BW030T2",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "寳藏",
    		subtypes: [
    			"寳藏"
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR004-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "本回合給予1個敵軍單位<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>與<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>。",
    		descriptionRaw: "本回合給予1個敵軍單位凍傷與弱勢。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「這些溫血人在弗雷爾卓德活不過一天！」 ——史瓦妮",
    		artistName: "Kudos Productions",
    		name: "寒風刺骨",
    		cardCode: "02FR004",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW019-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 6,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "充盈魔法能量的洋流經過毒蛇群島的珊瑚礁，滋養著海域中奇異的生物。",
    		artistName: "Kudos Productions",
    		name: "泡泡熊",
    		cardCode: "02BW019",
    		keywords: [
    			"調節",
    			"隱密"
    		],
    		keywordRefs: [
    			"Attune",
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW007-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 4,
    		health: 5,
    		description: "棄置2張牌即可出此牌。\r\n<link=vocab.Attack><style=Vocab>攻擊</style></link>：抽2張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>牌。",
    		descriptionRaw: "棄置2張牌即可出此牌。\r\n攻擊：抽2張飛逝牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「一般來說是很容易得手啦，桌邊的笨蛋們只顧啞著嗓子唱歌，根本不看賭桌。我才不甩他們呢，錢來了就對了，滾進我口袋總比留給他們好。」",
    		artistName: "JiHun Lee",
    		name: "惡賭徒",
    		cardCode: "02BW007",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ004-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予1個友軍單位+2|+0。\r\n在手牌生成1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.selfRef><style=AssociatedCard>蓄能衝擊</style></link>。",
    		descriptionRaw: "本回合給予1個友軍單位+2|+0。\r\n在手牌生成1張飛逝蓄能衝擊。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我的雙臂代我說話。」——菲艾",
    		artistName: "Kudos Productions",
    		name: "蓄能衝擊",
    		cardCode: "02PZ004",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW014-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 1,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，在手牌生成1張魔耗值1的法術。",
    		descriptionRaw: "召喚此牌時，在手牌生成1張魔耗值1的法術。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "大多數淺水域充滿了豐富的海洋生物，但與蔚藍航道的珊瑚礁比起來，盡皆相形遜色。蔚藍航道直如魔幻的異世界，處處都是驚奇。",
    		artistName: "Kudos Productions",
    		name: "珊瑚小頑童",
    		cardCode: "02BW014",
    		keywords: [
    			"調節"
    		],
    		keywordRefs: [
    			"Attune"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX006-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 4,
    		health: 5,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：對敵方主堡造成1點傷害。",
    		descriptionRaw: "回合開始：對敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "長老的聲音出乎意料地冷靜。「諾克薩斯人每次都成功地推翻我們建造的城牆，」他問道：「請你告訴我，現在採集石材來建更高的城牆又有何意義呢？」",
    		artistName: "Kudos Productions",
    		name: "攻城投石機",
    		cardCode: "02NX006",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE008-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 5,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "新加入的遊俠會和夥伴在森林一同生活幾個月，學著了解巨角鹿的一舉一動。這項訓練需要耐心才能完成，不過一旦培養出默契與感情，就沒人能離間他們。",
    		artistName: "SIXMOREVODKA",
    		name: "巨角獸拍檔",
    		cardCode: "02DE008",
    		keywords: [
    			"先遣"
    		],
    		keywordRefs: [
    			"Scout"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO008T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO008T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "本回合給予1個友軍單位+2|+0。",
    		descriptionRaw: "本回合給予1個友軍單位+2|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「……克敵致勝。」——李星",
    		artistName: "Kudos Productions",
    		name: "震驚百里",
    		cardCode: "02IO008T1",
    		keywords: [
    			"疾速",
    			"飛逝"
    		],
    		keywordRefs: [
    			"Burst",
    			"Fleeting"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW024.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW024-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "隨機召喚2個不分陣營、魔耗值1的侍從單位。",
    		descriptionRaw: "隨機召喚2個不分陣營、魔耗值1的侍從單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「哎呀蓋夫，那不是我們在追的傢伙嗎？看來他多了一個同伴。」\n「巴茲，那……那是鯊魚人嗎？」\n「不管怎樣都是一大筆錢啦，對吧。」——想賺錢的賞金獵人巴茲與蓋夫",
    		artistName: "Kudos Productions",
    		name: "雙倍麻煩",
    		cardCode: "02BW024",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW062.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW062-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 4,
    		health: 4,
    		description: "召喚此牌時，隨機生成1張不分陣營、魔耗值1的單位，並賦予其<link=keyword.Scout><sprite name=Scout><style=Keyword>先遣</style></link>。",
    		descriptionRaw: "召喚此牌時，隨機生成1張不分陣營、魔耗值1的單位，並賦予其先遣。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「海蛇之母恩光普照，\n從海底直到雲霄。\n灰色天空凝視地上，\n平靜海面仿佛反射她的目光。\n她輕輕微笑，心靈安詳。\n」——獻給娜葛卡布爾的禱告",
    		artistName: "Dao Le",
    		name: "島嶼領航員",
    		cardCode: "02BW062",
    		keywords: [
    			"先遣"
    		],
    		keywordRefs: [
    			"Scout"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW055.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW055-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 3,
    		health: 3,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：賦予<link=vocab.Everywhere><style=Vocab>各處</style></link>魔耗值1的友軍單位+1|+0。",
    		descriptionRaw: "洗劫：賦予各處魔耗值1的友軍單位+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "一旦她發射後，殘鉤團就必須趕快行動。水中的鮮血會招引各種來客……而且全都是不速之客。",
    		artistName: "JiHun Lee",
    		name: "殘鉤團監工",
    		cardCode: "02BW055",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI008T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI008T3-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「在這裡生活……毫不費力。茂盛的森林……一夜之間長大……十分美麗。這是一片至寶之地。得保存它……世世代代。」——拼湊起來的無名日記",
    		artistName: "MAR Studio",
    		name: "小樹精",
    		cardCode: "02SI008T3",
    		keywords: [
    			"閃靈",
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Ephemeral",
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO005"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO005T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO005T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "<link=keyword.Recall><style=Keyword>召回</style></link>此牌時，將其幻化為<link=card.cardRef><style=AssociatedCard>震盪掌</style></link>。",
    		descriptionRaw: "召回此牌時，將其幻化為震盪掌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「學徒必須動作優雅，因為巨龍的吐息變成了風浪，帶動整個世界的運行。」——龍道所傳教義",
    		artistName: "SIXMOREVODKA",
    		name: "龍尾武術家",
    		cardCode: "02IO005T1",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE004-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 2,
    		cost: 3,
    		health: 2,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我發誓守護這片森林，以及在該處尋求庇護的一切。」",
    		artistName: "Raphael Zenchetin",
    		name: "綠牙守衛",
    		cardCode: "02DE004",
    		keywords: [
    			"光盾",
    			"先遣"
    		],
    		keywordRefs: [
    			"Barrier",
    			"Scout"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "菁英",
    		subtypes: [
    			"菁英"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW030T2",
    			"02BW030T3",
    			"02BW030T1",
    			"02BW030T4"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW030.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW030-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 7,
    		cost: 7,
    		health: 5,
    		description: "召喚此牌時, <link=vocab.Toss><style=Vocab>亂擲</style></link>2張牌，並把2張寶藏牌洗入我方牌組。\r\n<style=Variable></style>",
    		descriptionRaw: "召喚此牌時, 亂擲2張牌，並把2張寶藏牌洗入我方牌組。\r\n",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我跟你擔保，這些日子來水面下的寶藏比水面上還來得多。應該可以手到擒來的，但有她在就困難了。」——鋸斧屠夫",
    		artistName: "Kudos Productions",
    		name: "沉船囤積者",
    		cardCode: "02BW030",
    		keywords: [
    			"探底"
    		],
    		keywordRefs: [
    			"Deep"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "海怪",
    		subtypes: [
    			"海怪"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02DE006",
    			"02DE006T1",
    			"02DE006T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE006T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE006T3-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "召喚<link=card.summon><style=AssociatedCard>威洛</style></link>。\r\n將1張<link=card.level1><style=AssociatedCard>葵恩</style></link>洗入我方牌組。",
    		descriptionRaw: "召喚威洛。\r\n將1張葵恩洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「飛到我頭髮裡了，我的頭髮！」——軍團流寇",
    		artistName: "Kudos Productions",
    		name: "葵恩 飛鷹突擊",
    		cardCode: "02DE006T3",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI007-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 1,
    		cost: 2,
    		health: 4,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：<link=vocab.Toss><style=Vocab>亂擲</style></link>2張牌並治癒我方主堡2點生命。",
    		descriptionRaw: "遺願：亂擲2張牌並治癒我方主堡2點生命。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「……非常出色的品種……這就是我小時候遇到過的那隻生物……一點都沒有變老！真想知道……下一個城鎮。說不定這些傢伙長生不老！」——拼湊起來的無名日記",
    		artistName: "MAR Studio",
    		name: "尖刺蛤蟆",
    		cardCode: "02SI007",
    		keywords: [
    			"遺願"
    		],
    		keywordRefs: [
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW003-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "個<link=vocab.Plunder><style=Vocab>洗劫</style></link>：將場上的1個侍從單位加入我方手牌。",
    		descriptionRaw: "個洗劫：將場上的1個侍從單位加入我方手牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你得替爾們工作啦！」——肖狗水手",
    		artistName: "Kudos Productions",
    		name: "強腕者",
    		cardCode: "02BW003",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW017-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 6,
    		health: 5,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫：</style></link>治癒所有友軍單位及我方主堡3點生命，然後進行<link=vocab.Rally><style=Vocab>備戰</style></link>。\r\n",
    		descriptionRaw: "洗劫：治癒所有友軍單位及我方主堡3點生命，然後進行備戰。\r\n",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「水手們都覺得自己最強壯了，時常東邊吼來西邊吼去。對啦對啦，表現棒極了。但你們還是得吃橘子！養顏美容，鞏固牙齒，還能讓我笑咍咍。你要不吃，要不就下水，簡單吧。」",
    		artistName: "SIXMOREVODKA",
    		name: "柑橘快遞猩",
    		cardCode: "02BW017",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI003-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 6,
    		cost: 8,
    		health: 5,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：本回合給予敵軍單位-2|-0。\r\n使海怪友軍單位擁有<link=keyword.Fearsome><sprite name=Fearsome><style=Keyword>威嚇</style></link>。\r\n<style=Variable></style>",
    		descriptionRaw: "攻擊：本回合給予敵軍單位-2|-0。\r\n使海怪友軍單位擁有威嚇。\r\n",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "他們察覺到危機時，為時已晚。巨大的怪物張開血盆大口，朝他們猛然攻擊；想要捕獲怪物的獵人，只能看著無盡的利齒逐漸粉碎他們的船隻，等待死亡臨頭。",
    		artistName: "SIXMOREVODKA",
    		name: "鬼船怪物",
    		cardCode: "02SI003",
    		keywords: [
    			"探底"
    		],
    		keywordRefs: [
    			"Deep"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "海怪",
    		subtypes: [
    			"海怪"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02NX007",
    			"02NX007T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX007T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX007T1-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "若該單位已負傷或遭到<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>，則對其造成4點傷害。\r\n將1張<link=card.level1><style=AssociatedCard>斯溫</style></link>洗入牌組。",
    		descriptionRaw: "若該單位已負傷或遭到擊暈，則對其造成4點傷害。\r\n將1張斯溫洗入牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "快聽，你聽見了嗎？那如雷貫耳的是上千雙羽翼的拍擊聲。",
    		artistName: "Kudos Productions",
    		name: "斯溫 群鴉盛宴",
    		cardCode: "02NX007T1",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW022T4",
    			"02BW022",
    			"02BW022T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW022T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW022T2-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 3,
    		health: 4,
    		description: "友軍單位攻擊時，對戰鬥中敵軍單位與敵方主堡造成1點傷害3次。",
    		descriptionRaw: "友軍單位攻擊時，對戰鬥中敵軍單位與敵方主堡造成1點傷害3次。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「普通人很難近距離欣賞這些槍砲上的絕頂工藝，你算幸運的了。」",
    		artistName: "SIXMOREVODKA",
    		name: "好運姐",
    		cardCode: "02BW022T2",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO002T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO002T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "賦予1個友軍單位+0|+3。",
    		descriptionRaw: "賦予1個友軍單位+0|+3。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「巨龍會保護你。」——龍麟拳師",
    		artistName: "Kudos Productions",
    		name: "龍之庇護",
    		cardCode: "02IO002T1",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ007-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "當我方打出1張魔耗值2的卡牌，抽1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>卡牌。",
    		descriptionRaw: "當我方打出1張魔耗值2的卡牌，抽1張飛逝卡牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「三流的偵探不知不覺，二流的偵探後知後覺，一流的偵探先知先覺。」——警備隊手冊",
    		artistName: "SIXMOREVODKA",
    		name: "新銳調查組員",
    		cardCode: "02PZ007",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW056T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW056.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW056-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 6,
    		health: 4,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：<link=keyword.Obliterate><style=Keyword>泯滅</style></link>1個生命值低於此牌的敵軍單位。\r\n<style=Variable></style>",
    		descriptionRaw: "出牌：泯滅1個生命值低於此牌的敵軍單位。\r\n",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「有一天我踏上小船，\n遠離比爾吉沃特灣。\n突然刮起狂風大浪，\n深海女王從海浮上……」 ——〈翼耳深海女王民謠〉",
    		artistName: "Kudos Productions",
    		name: "深淵吞噬者",
    		cardCode: "02BW056",
    		keywords: [
    			"探底"
    		],
    		keywordRefs: [
    			"Deep"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "海怪",
    		subtypes: [
    			"海怪"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW025",
    			"02BW046",
    			"02BW046T1",
    			"02BW046T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW046T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW046T3-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 1,
    		health: 2,
    		description: "施放法術時，給予此牌<link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>，並使以此牌為目標的所有法術和技能無效化。\r\n<link=vocab.Nexus Strike><style=Vocab>打擊主堡</style></link>：生成1張<link=card.create><style=AssociatedCard>海之霸主</style></link>。",
    		descriptionRaw: "施放法術時，給予此牌隱密，並使以此牌為目標的所有法術和技能無效化。\r\n打擊主堡：生成1張海之霸主。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "……其他人卻篤定地說這孩子只不過是貪玩，實際上常常護送人們安全回家。",
    		artistName: "SIXMOREVODKA",
    		name: "飛斯",
    		cardCode: "02BW046T3",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE006T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE006T2-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 2,
    		cost: 2,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "見過這隻猛禽的人都聲稱，牠那銳利的目光中閃著一絲智慧的光芒，牠的狡猾聰明是其他普通猛禽遙不可及的。 ",
    		artistName: "SIXMOREVODKA",
    		name: "威洛",
    		cardCode: "02DE006T2",
    		keywords: [
    			"挑戰者",
    			"先遣"
    		],
    		keywordRefs: [
    			"Challenger",
    			"Scout"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW046T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW025.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW025-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "賦予1個敵軍單位<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>，然後召喚<link=card.summon><style=AssociatedCard>長牙獸</style></link>。",
    		descriptionRaw: "賦予1個敵軍單位弱勢，然後召喚長牙獸。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「鯊魚出沒！」——飛斯",
    		artistName: "Kudos Productions",
    		name: "海之霸主",
    		cardCode: "02BW025",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW022T4.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW022T4-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對戰鬥中敵軍單位與敵方主堡連續造成3次1點傷害。",
    		descriptionRaw: "對戰鬥中敵軍單位與敵方主堡連續造成3次1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "就算你聽不到她手下船員大聲嚷嚷的汙言穢語，但她的狂笑一定會傳進你的耳朵裡……",
    		artistName: "Kudos Productions",
    		name: "彈幕",
    		cardCode: "02BW022T4",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02DE003"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE009-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 4,
    		health: 1,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：召喚1個<link=card.summon><style=AssociatedCard>忠心獾熊</style></link>。",
    		descriptionRaw: "遺願：召喚1個忠心獾熊。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "伯特蘭出自班德爾斥侯團，並榮獲無數勛章，就只差「笑臉迎人」獎。",
    		artistName: "SIXMOREVODKA",
    		name: "老練遊俠",
    		cardCode: "02DE009",
    		keywords: [
    			"先遣",
    			"遺願"
    		],
    		keywordRefs: [
    			"Scout",
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO006T3",
    			"02IO006T1",
    			"02IO006T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO006-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 6,
    		health: 6,
    		description: "施放法術時，本回合給予此牌<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。\r\n若再次施放法術，則額外給予其<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。",
    		descriptionRaw: "施放法術時，本回合給予此牌挑戰者。\r\n若再次施放法術，則額外給予其光盾。",
    		levelupDescription: "我方於本牌局中施放7次或以上法術<style=Variable></style>。",
    		levelupDescriptionRaw: "我方於本牌局中施放7次或以上法術。",
    		flavorText: "「配得的人，巨龍賜予協助；疲乏的人，巨龍賜予活力；患病的人，巨龍賜予舒緩；迷失的人，巨龍賜予光芒；動搖的人，巨龍賜予平衡……」",
    		artistName: "SIXMOREVODKA",
    		name: "李星",
    		cardCode: "02IO006",
    		keywords: [
    			"灌輸"
    		],
    		keywordRefs: [
    			"Imbue"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW038.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW038-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 4,
    		health: 2,
    		description: "召喚此牌時，從我方牌組抽出1張魔耗值3或以下的法術牌。",
    		descriptionRaw: "召喚此牌時，從我方牌組抽出1張魔耗值3或以下的法術牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "捷普曾經在三分鐘內游了蔚藍航道整整一圈，在尾段左閃右躲一一避開了熱鴉號四散的船骸！那天的海流實在是順啦！",
    		artistName: "Kudos Productions",
    		name: "電擊噴鰭魚",
    		cardCode: "02BW038",
    		keywords: [
    			"隱密",
    			"調節"
    		],
    		keywordRefs: [
    			"Elusive",
    			"Attune"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW021.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW021-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 5,
    		health: 4,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：賦予1個敵軍單位<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>。",
    		descriptionRaw: "出牌：賦予1個敵軍單位弱勢。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「聽說他會游上幾公里只為尋找獵物，一旦發現目標就絕不失手。很難說他是人還是魚，但可以肯定的是，他對這片水域瞭若指掌，熟悉程度超過了我們所有人。」——鋸斧屠夫",
    		artistName: "Alex Heath",
    		name: "銳鱗獵人",
    		cardCode: "02BW021",
    		keywords: [
    			"先遣"
    		],
    		keywordRefs: [
    			"Scout"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW022T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW022T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對戰鬥中敵軍單位與敵方主堡造成1點傷害。",
    		descriptionRaw: "對戰鬥中敵軍單位與敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「當作給你們的紀念吧。」——好運姐",
    		artistName: "Kudos Productions",
    		name: "愛的拍拍",
    		cardCode: "02BW022T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI001-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 5,
    		health: 4,
    		description: "另1個友軍單位陣亡時，從敵方主堡<link=keyword.Drain><style=Keyword>汲取</style></link>1點生命值。",
    		descriptionRaw: "另1個友軍單位陣亡時，從敵方主堡汲取1點生命值。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「碰上了那個叫……尼凡的新任擺渡人！他……載我們去……他很會唱歌！……在那之前……得邀請他來吃晚餐。」——拼湊起來的無名日記",
    		artistName: "Kudos Productions",
    		name: "冥河集魄人",
    		cardCode: "02SI001",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW026T5.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW026T5-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link><link=vocab.Strongest><style=Vocab>最強</style></link>敵軍單位，並對其造成2點傷害。",
    		descriptionRaw: "擊暈最強敵軍單位，並對其造成2點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「看那閃閃金光。」——逆命",
    		artistName: "Kudos Productions",
    		name: "金色卡牌",
    		cardCode: "02BW026T5",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW030T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW030T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "此牌遭到<link=vocab.Toss><style=Vocab>亂擲</style></link>時，反而會被抽出。在手牌中隨機生成5張魔耗值0的<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>卡牌。",
    		descriptionRaw: "此牌遭到亂擲時，反而會被抽出。在手牌中隨機生成5張魔耗值0的飛逝卡牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "芬恩船長大吼道：「這是你們應得的，兄弟們！就說比爾吉沃特稅只是膽小鬼的玩意！」有人隨聲歡呼，但並非全員。海面似乎靜止了，在蘭科號船身周圍冒出的泡泡越來越明顯。",
    		artistName: "Kudos Productions",
    		name: "沉船寳藏",
    		cardCode: "02BW030T1",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "寳藏",
    		subtypes: [
    			"寳藏"
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ002-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 5,
    		cost: 6,
    		health: 6,
    		description: "我方抽牌時，給予此牌<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>，然後生成1張此牌的複製牌。",
    		descriptionRaw: "我方抽牌時，給予此牌飛逝，然後生成1張此牌的複製牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "年僅五歲，她便製作了世上第一把的多周波震動刀。這把刀雖然不是很實用（通常她只是用來切三明治），但還是幫她得到了警備隊菁英裝備部門的職位。",
    		artistName: "SIXMOREVODKA",
    		name: "首席機械師澤維",
    		cardCode: "02PZ002",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW012-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "召喚2個<link=card.summon><style=AssociatedCard>火藥桶</style></link>。",
    		descriptionRaw: "召喚2個火藥桶。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「火藥桶！」——剛普朗克",
    		artistName: "Kudos Productions",
    		name: "更多的火藥！",
    		cardCode: "02BW012",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02SI008",
    			"02SI008T2",
    			"02SI008T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI008T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI008T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "<link=vocab.Toss><style=Vocab>亂擲</style></link>3張牌。\r\n治癒所有友軍單位3點生命。\r\n將1張<link=card.level1><style=AssociatedCard>茂凱</style></link>洗入我方牌組。",
    		descriptionRaw: "亂擲3張牌。\r\n治癒所有友軍單位3點生命。\r\n將1張茂凱洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「島嶼將被淨化。」——茂凱",
    		artistName: "Kudos Productions",
    		name: "茂凱 魔法樹液",
    		cardCode: "02SI008T1",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX002-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 6,
    		cost: 6,
    		health: 6,
    		description: "：所有負傷敵軍單位。",
    		descriptionRaw: "：所有負傷敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「多年來，我們屈服於他人，直到諾克薩斯征服了這片土地，我們才明白到何謂真正的自由，這也是我為帝國而戰的理由。」",
    		artistName: "Slawomir Maniak",
    		name: "奧洛·爍角 ",
    		cardCode: "02NX002",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE005-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "賦予1個友軍單位「傷害及死亡免疫」。",
    		descriptionRaw: "賦予1個友軍單位「傷害及死亡免疫」。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "這名遊俠忍著腿上的劇痛，再度站起身來，高舉佩劍。她能夠再站起來，不只單靠自己的決心，還有整個蒂瑪西亞的意志在支撐著她。",
    		artistName: "Max Grecke",
    		name: "不屈靈魂",
    		cardCode: "02DE005",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW035.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW035-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 6,
    		cost: 6,
    		health: 5,
    		description: "召喚此牌時，賦予所有敵軍單位<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>。",
    		descriptionRaw: "召喚此牌時，賦予所有敵軍單位弱勢。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "比爾吉沃特也許是個法外之地，但在喧囂熱鬧的城市裡，有少數英勇無懼的人，正依著自己的理念，貫徹他們的正義。",
    		artistName: "SIXMOREVODKA",
    		name: "薔薇警長",
    		cardCode: "02BW035",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02SI002",
    			"02SI002",
    			"02SI002",
    			"02SI002",
    			"02SI002",
    			"02SI002",
    			"02SI002",
    			"02SI002",
    			"02SI002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI002-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 7,
    		health: 3,
    		description: "召喚1個侍從單位時，擊殺它來召喚1個<link=card.summon><style=AssociatedCard>巨型食人蔓藤</style></link>。",
    		descriptionRaw: "召喚1個侍從單位時，擊殺它來召喚1個巨型食人蔓藤。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「今天……又有驚人的……四處冒出來……孩子們都非常害怕。不過……並不威脅。整天靠過來……真是不怕人的傢伙。得為牠們收集多一點莓果！」——拼湊起來的無名日記",
    		artistName: "SIXMOREVODKA",
    		name: "巨型食人蔓藤",
    		cardCode: "02SI002",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO004-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 6,
    		health: 6,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「學徒必須全力以赴，因為巨龍使旱地從海中隆起，賜予我們名為家鄉的土地。」——龍道所傳教義",
    		artistName: "JiHun Lee",
    		name: "龍角力士",
    		cardCode: "02IO004",
    		keywords: [
    			"雙重攻擊"
    		],
    		keywordRefs: [
    			"DoubleStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW058.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW058-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 1,
    		health: 2,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：賦予此牌+1|+1。",
    		descriptionRaw: "洗劫：賦予此牌+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "要加入殘鉤團絕非易事，水手必須證明自己有一手出色的航海、戰鬥及烹飪技術，差勁的應徵者一轉眼就會被三振出局。",
    		artistName: "Slawomir Maniak",
    		name: "殘鉤團屠夫",
    		cardCode: "02BW058",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW026T2",
    			"02BW026T5",
    			"02BW026T4",
    			"02BW026",
    			"02BW026T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW026T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW026T3-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "此牌在場上時，我方每打出1張牌，則此牌打出一張「命運」，每回合上限3次。",
    		descriptionRaw: "此牌在場上時，我方每打出1張牌，則此牌打出一張「命運」，每回合上限3次。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「基本上這不算是賭博，因為我不會輸。」",
    		artistName: "SIXMOREVODKA",
    		name: "逆命",
    		cardCode: "02BW026T3",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW028T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW028T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對1個單位造成2點傷害。\r\n若該單位陣亡或離開場上，則改為對敵方主堡造成1點傷害。",
    		descriptionRaw: "對1個單位造成2點傷害。\r\n若該單位陣亡或離開場上，則改為對敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "剛普朗克的暴行不會止於那些冒犯他的人。只要膽敢與海洋之災為敵，你所珍視的人都將遭逢死劫。",
    		artistName: "Kudos Productions",
    		name: "加農炮幕",
    		cardCode: "02BW028T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW018-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "對任一目標造成1點傷害。\r\n若擊殺該單位，則另外對敵方主堡造成1點傷害。",
    		descriptionRaw: "對任一目標造成1點傷害。\r\n若擊殺該單位，則另外對敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "剛普朗克的談判過程通常都很短，不過必定見血。",
    		artistName: "Kudos Productions",
    		name: "槍火談判",
    		cardCode: "02BW018",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW037.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW037-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 5,
    		health: 3,
    		description: "<link=vocab.Nexus Strike><style=Vocab>打擊主堡</style></link>：抽1張牌。\r\n<style=Variable></style>",
    		descriptionRaw: "打擊主堡：抽1張牌。\r\n",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「船長一聲號令，他們升起船帆，\n前往娜敘亞麥，幫忙解決麻煩。\n但大海鬧翻臉，眾多兄弟入殮，\n只有倖存船員，能見全知之眼！」\n——〈全知之眼〉",
    		artistName: "Kudos Productions",
    		name: "深淵之眼",
    		cardCode: "02BW037",
    		keywords: [
    			"隱密",
    			"探底"
    		],
    		keywordRefs: [
    			"Elusive",
    			"Deep"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "海怪",
    		subtypes: [
    			"海怪"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO003T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO003T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO003T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 2,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「聽者必獲神靈恩賜。」——龍瞳修行者",
    		artistName: "SIXMOREVODKA",
    		name: "幼龍",
    		cardCode: "02IO003T1",
    		keywords: [
    			"閃靈",
    			"吸血"
    		],
    		keywordRefs: [
    			"Ephemeral",
    			"Lifesteal"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02FR002T3",
    			"02FR002T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR002-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 5,
    		cost: 6,
    		health: 6,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：本回合給予1個敵軍單位<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>與<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>。 ",
    		descriptionRaw: "出牌：本回合給予1個敵軍單位凍傷與弱勢。 ",
    		levelupDescription: "我方在本牌局對敵方主堡造成傷害累計5回合<style=Variable></style>。",
    		levelupDescriptionRaw: "我方在本牌局對敵方主堡造成傷害累計5回合。",
    		flavorText: "史瓦妮的冰星錘的確強大，不過她自己才是真正的武器：一把經歷過弗雷爾卓德艱苦寒冷磨練和試煉的武器。",
    		artistName: "SIXMOREVODKA",
    		name: "史瓦妮",
    		cardCode: "02FR002",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW048.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW048-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "隨機召喚1個不分陣營、魔耗值1的侍從單位。",
    		descriptionRaw: "隨機召喚1個不分陣營、魔耗值1的侍從單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「巴茲，你怎麼看？這傢伙看起來不是很強。」\n「你確定嗎，蓋夫？他可是從監牢裡逃出來的耶……」\n「這只能說明他夠狡猾，而不是夠強。我們上吧！」——未成氣候的賞金獵人巴茲和蓋夫",
    		artistName: "Kudos Productions",
    		name: "越獄",
    		cardCode: "02BW048",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW043.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW043-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "將1張手牌洗入我方牌組，於下一輪 <link=vocab.RoundStart><style=Vocab>回合開始</style></link>抽3張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>牌。",
    		descriptionRaw: "將1張手牌洗入我方牌組，於下一輪 回合開始抽3張飛逝牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「運氣是自己創造出來的。」——逆命",
    		artistName: "Kudos Productions",
    		name: "選牌",
    		cardCode: "02BW043",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR001-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：對所有目標造成1點傷害。",
    		descriptionRaw: "回合開始：對所有目標造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「他們努力耕田，\n默默撒種。\n我們隨心所欲，\n燒光一切！」——冬之爪童謠",
    		artistName: "SIXMOREVODKA",
    		name: "縱火女強盜",
    		cardCode: "02FR001",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW008T02.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW008T02-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 3,
    		health: 1,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：隨機召喚1個不分陣營、魔耗值1的友軍單位。",
    		descriptionRaw: "出牌：隨機召喚1個不分陣營、魔耗值1的友軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "",
    		artistName: "SIXMOREVODKA",
    		name: "肖狗水手 乙",
    		cardCode: "02BW008T02",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW008T01.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW008T01-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 3,
    		health: 1,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：召喚1個<link=card.summon><style=AssociatedCard>火藥桶</style></link>。",
    		descriptionRaw: "出牌：召喚1個火藥桶。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "",
    		artistName: "SIXMOREVODKA",
    		name: "肖狗水手 甲",
    		cardCode: "02BW008T01",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW051.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW051-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "從戰鬥中移除1個攻擊中的友軍單位，然後進行<link=vocab.Rally><style=Vocab>備戰</style></link>。",
    		descriptionRaw: "從戰鬥中移除1個攻擊中的友軍單位，然後進行備戰。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「快你一步！」——飛斯",
    		artistName: "Max Grecke",
    		name: "調皮小飛",
    		cardCode: "02BW051",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW053"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW054.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW054-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>1個敵軍單位。\r\n若有1個友軍<link=card.champCheck><style=AssociatedCard>納帝魯斯</style></link>，則可將該名敵軍單位洗入敵方牌組。",
    		descriptionRaw: "擊暈1個敵軍單位。\r\n若有1個友軍納帝魯斯，則可將該名敵軍單位洗入敵方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「把他們拖入深淵……」——納帝魯斯",
    		artistName: "Kudos Productions",
    		name: "鋼鐵怒濤",
    		cardCode: "02BW054",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02SI008T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI004-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 3,
    		health: 1,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：擊殺1個友軍單位來召喚2個<link=card.create><style=AssociatedCard>小樹精</style></link>。",
    		descriptionRaw: "出牌：擊殺1個友軍單位來召喚2個小樹精。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「每顆心都像一座花園，等著大樹生根！」",
    		artistName: "MAR Studio",
    		name: "樹精保姆",
    		cardCode: "02SI004",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO006T3",
    			"02IO006",
    			"02IO006T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO006T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO006T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 6,
    		health: 7,
    		description: "\r\n\n我方施放法術時，本回合給予此牌<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>，再次施放法術時，則額外給予<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。此牌<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰</style></link>單位時，對其施放<link=card.attackSpell><style=AssociatedCard>神龍擺尾</style></link>。",
    		descriptionRaw: "\r\n\n我方施放法術時，本回合給予此牌挑戰者，再次施放法術時，則額外給予光盾。此牌挑戰單位時，對其施放神龍擺尾。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「……對於霸道的人，巨龍則使其烈火焚身。」",
    		artistName: "SIXMOREVODKA",
    		name: "李星",
    		cardCode: "02IO006T1",
    		keywords: [
    			"灌輸"
    		],
    		keywordRefs: [
    			"Imbue"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW026",
    			"02BW026T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW026T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW026T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "將1張手牌洗入牌組，於下一輪<link=vocab.RoundStart><style=Vocab>回合開始</style></link>抽3張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>牌。\r\n將1張<link=card.level1><style=AssociatedCard>逆命</style></link>洗入我方牌組。",
    		descriptionRaw: "將1張手牌洗入牌組，於下一輪回合開始抽3張飛逝牌。\r\n將1張逆命洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「運氣是自己創造出來的。」——逆命",
    		artistName: "Kudos Productions",
    		name: "逆命 選牌",
    		cardCode: "02BW026T1",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO003T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO003-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 2,
    		health: 3,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：若上一回合施放2次或以上法術，則召喚1個<link=card.summon><style=AssociatedCard>幼龍</style></link><style=Variable></style>。",
    		descriptionRaw: "回合開始：若上一回合施放2次或以上法術，則召喚1個幼龍。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「學徒必須思想清晰，因為巨龍的牽引讓太陽劃過天際，照亮我們的世界。」——龍道所傳教義",
    		artistName: "Dao Le",
    		name: "龍瞳修行者",
    		cardCode: "02IO003",
    		keywords: [
    			"調節"
    		],
    		keywordRefs: [
    			"Attune"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW053",
    			"02BW053",
    			"02BW053T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW053T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW053T2-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>1個敵軍單位。\r\n若我方場上有<link=card.champCheck><style=AssociatedCard>納帝魯斯</style></link>，則可將該單位洗入敵方牌組，\r\n將1張<link=card.level1><style=AssociatedCard>納帝魯斯</style></link>洗入我方牌組。",
    		descriptionRaw: "擊暈1個敵軍單位。\r\n若我方場上有納帝魯斯，則可將該單位洗入敵方牌組，\r\n將1張納帝魯斯洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「把他們拖入深淵……」——納帝魯斯",
    		artistName: "Kudos Productions",
    		name: "納帝魯斯 鋼鐵怒濤",
    		cardCode: "02BW053T2",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO001-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "本回合打出2次法術牌就能從手牌中召喚此牌。",
    		descriptionRaw: "本回合打出2次法術牌就能從手牌中召喚此牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「學徒必須專心聆聽，因為巨龍發出了原初之咆哮，將魔力賜給我們未臻成熟的心靈。」——龍道所傳教義",
    		artistName: "SIXMOREVODKA",
    		name: "龍爪女俠",
    		cardCode: "02IO001",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02SI008T2",
    			"02SI008T1",
    			"02SI008T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI008-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 1,
    		cost: 4,
    		health: 4,
    		description: "我方每回合首次打出另一個友軍單位時，<link=vocab.Toss><style=Vocab>亂擲</style></link>2張牌並召喚1個<link=card.summon><style=AssociatedCard>小樹精</style></link>。",
    		descriptionRaw: "我方每回合首次打出另一個友軍單位時，亂擲2張牌並召喚1個小樹精。",
    		levelupDescription: "本牌局我方單位陣亡或卡牌遭25次。<style=Variable></style>。",
    		levelupDescriptionRaw: "本牌局我方單位陣亡或卡牌遭25次。。",
    		flavorText: "這片詛咒大地也拿茂凱沒轍，這名樹人的意志太過堅定、憤怒太過熾熱，無人能敵、無物能擋。",
    		artistName: "SIXMOREVODKA",
    		name: "茂凱",
    		cardCode: "02SI008",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02PZ008T2",
    			"02PZ008T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ008-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 5,
    		health: 5,
    		description: "無論此牌在場上或在手牌中，我方每打出其它牌，即賦予此牌+1|+0（最多+8|+0）。<style=Variable></style>。",
    		descriptionRaw: "無論此牌在場上或在手牌中，我方每打出其它牌，即賦予此牌+1|+0（最多+8|+0）。。",
    		levelupDescription: "當此牌<link=vocab.Strike><style=Vocab>打擊</style></link>累積造成10+傷害。",
    		levelupDescriptionRaw: "當此牌打擊累積造成10+傷害。",
    		flavorText: "「菲艾特警，拜託妳稍微為他人著想一下可以嗎？出任務造成那麼多破壞，你知道有多少毀損申報單要填嗎！？」——新銳調查組員",
    		artistName: "SIXMOREVODKA",
    		name: "菲艾",
    		cardCode: "02PZ008",
    		keywords: [
    			"挑戰者",
    			"堅忍"
    		],
    		keywordRefs: [
    			"Challenger",
    			"Tough"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI006-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "友軍單位首次陣亡時，賦予此牌+2|+2。",
    		descriptionRaw: "友軍單位首次陣亡時，賦予此牌+2|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "闇影島的生物早就捨棄情感；他們都得吃點什麼才行。",
    		artistName: "MAR Studio",
    		name: "低吼樹怪",
    		cardCode: "02SI006",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW047.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW047-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "召喚此牌時，<link=vocab.Toss><style=Vocab>亂擲</style></link>3張卡牌。",
    		descriptionRaw: "召喚此牌時，亂擲3張卡牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "能夠把好好的出海裝備全部弄壞，可以說是一種天分，不過這也是他們唯一的天分。",
    		artistName: "Alex Heath",
    		name: "殘渣打撈者",
    		cardCode: "02BW047",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX009-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "若該單位已負傷或遭到<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>，則對其造成4點傷害。",
    		descriptionRaw: "若該單位已負傷或遭到擊暈，則對其造成4點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "快聽，你聽見了嗎？那如雷貫耳的是上千雙羽翼的拍擊聲。",
    		artistName: "Kudos Productions",
    		name: "群鴉盛宴",
    		cardCode: "02NX009",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW008-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 3,
    		health: 1,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：召喚1個<link=card.summon><style=AssociatedCard>火藥桶</style></link>，或隨機召喚1個不分陣營、魔耗值1的友軍單位。",
    		descriptionRaw: "出牌：召喚1個火藥桶，或隨機召喚1個不分陣營、魔耗值1的友軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "他後來總算懂了，除了點燃的引線外，很少有東西能逼得打混水手認真幹活。",
    		artistName: "SIXMOREVODKA",
    		name: "肖狗水手",
    		cardCode: "02BW008",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02NX007T2",
    			"02NX007T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX007-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 5,
    		health: 6,
    		description: "<link=vocab.Nexus Strike><style=Vocab>打擊主堡</style></link>：對敵方主堡造成<style=Variable>3</style>點傷害。",
    		descriptionRaw: "打擊主堡：對敵方主堡造成3點傷害。",
    		levelupDescription: "本牌局中我方造成12次非戰鬥傷害<style=Variable></style>。",
    		levelupDescriptionRaw: "本牌局中我方造成12次非戰鬥傷害。",
    		flavorText: "「一股凡人無法理解的力量，讓我能夠看見常人無法看見的事物，洞察常人恐懼的黑暗。」",
    		artistName: "SIXMOREVODKA",
    		name: "斯溫",
    		cardCode: "02NX007",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW053T1",
    			"02BW053T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW053.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW053-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 7,
    		health: 12,
    		description: "此牌升級時，複製被<link=vocab.Toss><style=Vocab>亂擲</style></link>且魔耗值4點或以上的友軍單位至我方牌組。",
    		descriptionRaw: "此牌升級時，複製被亂擲且魔耗值4點或以上的友軍單位至我方牌組。",
    		levelupDescription: "我方進入<link=keyword.Deep><sprite name=Deep><style=Keyword>探底</style></link>狀態。<style=Variable></style>",
    		levelupDescriptionRaw: "我方進入探底狀態。",
    		flavorText: "「錨被拔起帆被扯下，蘭科號轉眼變得七零八落。活下來的只剩我們幾個，而夜晚將至，寒冷也將追隨而來。抱歉了媽媽，妳說的對，泰坦巨獸是真實存在的。」—殘破筆記拼湊出的內容",
    		artistName: "SIXMOREVODKA",
    		name: "納帝魯斯",
    		cardCode: "02BW053",
    		keywords: [
    			"堅忍",
    			"威嚇"
    		],
    		keywordRefs: [
    			"Tough",
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02FR005"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR005T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR005T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 6,
    		cost: 5,
    		health: 6,
    		description: "使其他力量值5點或以上的友軍單位擁有<link=keyword.Overwhelm><sprite name=Overwhelm><style=Keyword>勢不可擋</style></link>。",
    		descriptionRaw: "使其他力量值5點或以上的友軍單位擁有勢不可擋。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "巨熊族捨棄了人性，完全釋放自己，駕馭雷暴之力：以閃電之姿穿越凍原，以雷吼之聲隆隆咆哮。",
    		artistName: "Kudos Productions",
    		name: "風暴之爪巨熊",
    		cardCode: "02FR005T1",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032",
    			"02BW032T2",
    			"02BW032T1",
    			"02BW032T4"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW032T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW032T3-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 6,
    		cost: 5,
    		health: 6,
    		description: "召喚此牌時及<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：召喚1個<link=card.summon><style=AssociatedCard>火藥桶</style></link>。\r\n<link=keyword.AttackSkillMark><sprite name=AttackSkillMark><style=Keyword>攻擊</style></link>：對所有敵軍單位及敵方主堡造成1點傷害。",
    		descriptionRaw: "召喚此牌時及回合開始：召喚1個火藥桶。\r\n攻擊：對所有敵軍單位及敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我最清楚老大，他的眼中只有怒火，肯定有一天會向比爾吉沃特報仇雪恨。」——肖狗水手",
    		artistName: "SIXMOREVODKA",
    		name: "剛普朗克",
    		cardCode: "02BW032T3",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR010-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "賦予我方牌組最上方3個單位+1|+1。\r\n<link=vocab.Plunder><style=Vocab>洗劫</style></link>：隨後抽出其中1張。",
    		descriptionRaw: "賦予我方牌組最上方3個單位+1|+1。\r\n洗劫：隨後抽出其中1張。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「有好東西要跟好朋友『分享』嘛。」—— 無情劫掠者",
    		artistName: "Kudos Productions",
    		name: "集體分贓",
    		cardCode: "02FR010",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW004-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，召喚1個<link=card.summon><style=AssociatedCard>火藥桶</style></link>。",
    		descriptionRaw: "召喚此牌時，召喚1個火藥桶。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「喂，我們可以天亮了再攻擊，不過那時他們的船員已經清醒，大砲也已填滿火藥；倒不如今晚偷偷送上一份大禮，大功告成、不動聲色……」",
    		artistName: "Dao Le",
    		name: "恐懼號水手",
    		cardCode: "02BW004",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW002-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 9,
    		health: 8,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：抽出1張<link=card.champ1><style=AssociatedCard>剛普朗克</style></link>。\r\n使友軍單位造成的所有傷害加倍。",
    		descriptionRaw: "出牌：抽出1張剛普朗克。\r\n使友軍單位造成的所有傷害加倍。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「呦齁齁，揮揮手帕，揚帆啟航，\n恐懼號將遨遊四方。\n我們要前進深淵，看那滿坑谷墓碑，恐懼號從不退卻！」——〈恐懼號出航曲〉",
    		artistName: "SIXMOREVODKA",
    		name: "恐懼號",
    		cardCode: "02BW002",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW032T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW032T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 1,
    		description: "使我方法術和技能傷害增加<style=Variable>1</style>點。一旦使用法術或技能對敵軍造成傷害後，摧毀此牌。",
    		descriptionRaw: "使我方法術和技能傷害增加1點。一旦使用法術或技能對敵軍造成傷害後，摧毀此牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「有火藥者事竟成。」——比爾吉沃特俗諺",
    		artistName: "Kudos Productions",
    		name: "火藥桶",
    		cardCode: "02BW032T1",
    		keywords: [
    			"定身",
    			"弱勢"
    		],
    		keywordRefs: [
    			"Immobile",
    			"Vulnerable"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO005T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO005-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 4,
    		health: 2,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>1個敵軍單位來召喚一個<link=card.cardRef><style=AssociatedCard>龍尾武術家</style></link>。",
    		descriptionRaw: "擊暈1個敵軍單位來召喚一個龍尾武術家。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我離開時無影無蹤，歸來時亦杳無聲息。」——龍尾武術家",
    		artistName: "Kudos Production",
    		name: "震盪掌",
    		cardCode: "02IO005",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02NX004T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX004-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：對1個友軍單位造成1點傷害後，對敵方主堡造成2點傷害。",
    		descriptionRaw: "出牌：對1個友軍單位造成1點傷害後，對敵方主堡造成2點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「悄無聲息，直到轟地一聲！」",
    		artistName: "Dao Le",
    		name: "帝國炸彈工兵",
    		cardCode: "02NX004",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW016-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 3,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：上回合我方每抽1張牌，則賦予此牌+0|+1，然後調換其能力值。\r\n<style=Variable></style>",
    		descriptionRaw: "回合開始：上回合我方每抽1張牌，則賦予此牌+0|+1，然後調換其能力值。\r\n",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "有一個原型轉到了三個炸彈然後整台爆炸，後來的型號就把這項功能移除了。",
    		artistName: "Kudos Productions",
    		name: "拉霸機器人",
    		cardCode: "02BW016",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW030T4.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW030T4-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 5,
    		cost: 5,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "令人恐懼的怪物破浪而出，用咬力強勁的雙顎將船身裂成兩半。就算水手們乞求著倒刺女神的原宥，船長的貪念卻早已註定了他們的命運。",
    		artistName: "SIXMOREVODKA",
    		name: "兇惡鎧龍",
    		cardCode: "02BW030T4",
    		keywords: [
    			"威嚇",
    			"探底"
    		],
    		keywordRefs: [
    			"Fearsome",
    			"Deep"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "海怪",
    		subtypes: [
    			"海怪"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02DE006T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE002-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "召喚<link=card.summon><style=AssociatedCard>威洛</style></link>。",
    		descriptionRaw: "召喚威洛。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「飛到我頭髮裡了，我的頭髮！」——軍團流寇",
    		artistName: "Kudos Productions",
    		name: "飛鷹突擊",
    		cardCode: "02DE002",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX003-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "對1個友軍單位造成3點傷害後，對任一目標造成3點傷害。",
    		descriptionRaw: "對1個友軍單位造成3點傷害後，對任一目標造成3點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「犧牲是必須的。」——傑利科．斯溫",
    		artistName: "Kudos Productions",
    		name: "諾克薩斯狂熱",
    		cardCode: "02NX003",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02FR002",
    			"02FR002T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR008-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 7,
    		cost: 8,
    		health: 7,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：使我方牌組中單位的力量值和生命值加倍。\r\n<link=vocab.Play><style=Vocab>出牌</style></link>：抽出1張<link=card.champ1><style=AssociatedCard>史瓦妮</style></link>。\r\n",
    		descriptionRaw: "洗劫：使我方牌組中單位的力量值和生命值加倍。\r\n出牌：抽出1張史瓦妮。\r\n",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「春天不只帶來適合種植的溫暖天氣，也會帶來劫盜船……本來數量繁多的糧食也會變得稀少。」——艾伐洛森爐衛",
    		artistName: "SIXMOREVODKA",
    		name: "角獸劫掠者",
    		cardCode: "02FR008",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02FR002",
    			"02FR002T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR002T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR002T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "本回合給予1個友軍單位+4|+4。\r\n將1張<link=card.level1><style=AssociatedCard>史瓦妮</style></link> 洗入我方牌組。",
    		descriptionRaw: "本回合給予1個友軍單位+4|+4。\r\n將1張史瓦妮 洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「擁抱心中的野性吧！」 ——史瓦妮",
    		artistName: "Kudos Productions",
    		name: "史瓦妮 北境之怒",
    		cardCode: "02FR002T1",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO006T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO006T3-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "使1個友軍單位將1個敵軍單位踢向敵方主堡，視為對兩者進行<link=vocab.Strike><style=Vocab>打擊</style></link>。\r\n若敵軍單位存活，則將其<link=keyword.Recall><style=Keyword>召回</style></link>。",
    		descriptionRaw: "使1個友軍單位將1個敵軍單位踢向敵方主堡，視為對兩者進行打擊。\r\n若敵軍單位存活，則將其召回。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「必須釋放巨龍，不然牠會從內心吞噬我。」——李星",
    		artistName: "Kudos Productions",
    		name: "神龍擺尾",
    		cardCode: "02IO006T3",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ009-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "在手牌生成1張魔耗值2的隨機卡牌，本回合其魔耗值降為0。",
    		descriptionRaw: "在手牌生成1張魔耗值2的隨機卡牌，本回合其魔耗值降為0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「就這樣，」哈諾克探長宣布，「這條線索帶我們發現了……」",
    		artistName: "Kudos Productions",
    		name: "蛛絲馬跡",
    		cardCode: "02PZ009",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE010-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 6,
    		health: 4,
    		description: "召喚此牌時，本回合給予其他友軍單位+1|+1。",
    		descriptionRaw: "召喚此牌時，本回合給予其他友軍單位+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "蒂瑪西亞遊俠戰鬥時的模樣鼓舞人心——他們人獸合一並肩作戰，形影不離，而且意志堅定。",
    		artistName: "SIXMOREVODKA",
    		name: "珍妮薇．艾姆哈特",
    		cardCode: "02DE010",
    		keywords: [
    			"先遣",
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Scout",
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO002T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO002-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 3,
    		health: 2,
    		description: "召喚此牌時，在手牌生成1張<link=card.create><style=AssociatedCard>龍之庇護</style></link>。",
    		descriptionRaw: "召喚此牌時，在手牌生成1張龍之庇護。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「學徒必須慈悲為懷，因為巨龍養育了最初淨土，並賜予溫暖和生命。」——龍道所傳教義",
    		artistName: "SIXMOREVODKA",
    		name: "龍麟拳師",
    		cardCode: "02IO002",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW026T2",
    			"02BW026T5",
    			"02BW026T4",
    			"02BW026T3",
    			"02BW026T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW026.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW026-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 4,
    		health: 2,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：打出1張「命運」卡牌。",
    		descriptionRaw: "出牌：打出1張「命運」卡牌。",
    		levelupDescription: "此牌在場上時我方抽出8張或以上卡牌<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌在場上時我方抽出8張或以上卡牌。",
    		flavorText: "「專心看雙手的動作，計算卡牌數量，眼睛盡量跟上，然後別忘了……」",
    		artistName: "SIXMOREVODKA",
    		name: "逆命",
    		cardCode: "02BW026",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW036"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW027.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW027-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 7,
    		cost: 5,
    		health: 7,
    		description: "召喚此牌時，為敵方召喚1個<link=card.summon><style=AssociatedCard>黃金獨角鯨</style></link>。",
    		descriptionRaw: "召喚此牌時，為敵方召喚1個黃金獨角鯨。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "在海浪之下閃爍著光芒的不是金幣，也不是金條，而是一支光澤耀眼的號角，屬於殘惡艦隊總指揮那精明的死對頭。",
    		artistName: "SIXMOREVODKA",
    		name: "狩獵艦隊",
    		cardCode: "02BW027",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02FR002",
    			"02FR002T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR002T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR002T3-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 6,
    		cost: 6,
    		health: 7,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：本回合給予1個敵軍單位<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>與<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>。\r\n此牌在場上時，若我方對敵方主堡造成傷害，則<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>所有敵軍單位，每回合僅限發動1次。",
    		descriptionRaw: "出牌：本回合給予1個敵軍單位凍傷與弱勢。\r\n此牌在場上時，若我方對敵方主堡造成傷害，則凍傷所有敵軍單位，每回合僅限發動1次。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「擊垮他們，讓他們知道弗雷爾卓德屬於冬之爪！」",
    		artistName: "SIXMOREVODKA",
    		name: "史瓦妮",
    		cardCode: "02FR002T3",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO010T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO010-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "<link=keyword.Recall><style=Keyword>召回</style></link>1個友軍單位以在手牌生成1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.secondSpell><style=AssociatedCard>打道回府</style></link>。",
    		descriptionRaw: "召回1個友軍單位以在手牌生成1張飛逝打道回府。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "第一批在愛歐尼亞登陸的諾克薩斯人，遇到一群且毫無準備的弱軍。諾克薩斯人屠殺無數，但有其中一群從虎口逃生……",
    		artistName: "Kudos Productions",
    		name: "走為上策",
    		cardCode: "02IO010",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW042.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW042-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "本回合變更所有友軍單位的力量值與生命值，改為我方本牌局中所打出的法術牌數量。<style=Variable></style>",
    		descriptionRaw: "本回合變更所有友軍單位的力量值與生命值，改為我方本牌局中所打出的法術牌數量。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "比爾吉沃特周邊海流湍急、波翻變幻，水手會害怕是理所當然；但他們並不全然了解，大海中所潛藏真正令人恐懼的力量。",
    		artistName: "Kudos Productions",
    		name: "心靈相通",
    		cardCode: "02BW042",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE007-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "本回合給予所有友軍單位<link=keyword.Tough><sprite name=Tough><style=Keyword>堅忍</style></link>。",
    		descriptionRaw: "本回合給予所有友軍單位堅忍。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「敵人逼近時，無需膽怯，樹林會保護我們。」——綠牙守衛",
    		artistName: "Kudos Productions",
    		name: "遊俠決心",
    		cardCode: "02DE007",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW059.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW059-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "<link=vocab.Toss><style=Vocab>亂擲</style></link>3張牌。\r\n對1個單位造成7點傷害。",
    		descriptionRaw: "亂擲3張牌。\r\n對1個單位造成7點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「能夠打沉敵人的，就是值得擁有的。」——比爾吉沃特俗語",
    		artistName: "Kudos Productions",
    		name: "遜槍手",
    		cardCode: "02BW059",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR007-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "本回合給予1個單位+4|+4。",
    		descriptionRaw: "本回合給予1個單位+4|+4。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「擁抱心中的野性吧！」 ——史瓦妮",
    		artistName: "Kudos Productions",
    		name: "北境之怒",
    		cardCode: "02FR007",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW032T4.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW032T4-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對所有敵軍單位與敵方主堡造成1點傷害。",
    		descriptionRaw: "對所有敵軍單位與敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「把他們轟進深淵吧！」——剛普朗克",
    		artistName: "Kudos Productions",
    		name: "火藥爆爆",
    		cardCode: "02BW032T4",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW050.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW050-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 7,
    		health: 4,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：手牌與牌組中友軍魔耗值-2。",
    		descriptionRaw: "洗劫：手牌與牌組中友軍魔耗值-2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「快跟我們踏上一場音樂之旅！欣賞符文大地各地的美妙旋律！謹記付費入場，還有給些小費……」——表演宣傳人員",
    		artistName: "Chin LikHui",
    		name: "圓滑獨奏家",
    		cardCode: "02BW050",
    		keywords: [
    			"隱密"
    		],
    		keywordRefs: [
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02DE006",
    			"02DE006T3",
    			"02DE006T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE006T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE006T1-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 5,
    		health: 5,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：召喚1個<link=card.create><style=AssociatedCard>威洛</style></link>，該單位出場時即<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰[Vocab:Strongest]最強</style></link>敵軍單位。",
    		descriptionRaw: "攻擊：召喚1個威洛，該單位出場時即挑戰[Vocab:Strongest]最強敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「威洛，你帶路，我跟著！」",
    		artistName: "SIXMOREVODKA",
    		name: "葵恩",
    		cardCode: "02DE006T1",
    		keywords: [
    			"先遣"
    		],
    		keywordRefs: [
    			"Scout"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW028T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW028.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW028-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 7,
    		cost: 8,
    		health: 4,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：對隨機敵軍<link=card.cast><style=AssociatedCard>加農炮幕</style></link>7次。",
    		descriptionRaw: "洗劫：對隨機敵軍加農炮幕7次。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「駛過水手，駛過殘骸，\n打鬥告終。\n霧氣消散後，船長遇見了雷克斯，\n船身於是支離破碎，成為斷裂的浮木。」——〈水手家之心〉",
    		artistName: "MAR Studio",
    		name: "怒濤狂鯊砲",
    		cardCode: "02BW028",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW023.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW023-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "使我方<link=vocab.Everywhere><style=Vocab>各處</style></link>海怪魔耗值-1。\r\n抽1張海怪牌。",
    		descriptionRaw: "使我方各處海怪魔耗值-1。\r\n抽1張海怪牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "水手們低聲討論著即將降臨的黑暗日子——海面將翻騰湧動，無法言喻的怪物將從浪潮中破水而出。",
    		artistName: "Kudos Productions",
    		name: "深淵之引誘",
    		cardCode: "02BW023",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02SI008T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI009-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "下回合召喚1個<link=card.summon><style=AssociatedCard>小樹精</style></link>。",
    		descriptionRaw: "下回合召喚1個小樹精。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「耶～」——小樹精",
    		artistName: "Kudos Productions",
    		name: "扭曲樹精",
    		cardCode: "02SI009",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ003-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "抽到此牌時，此牌本回合魔耗值-2。\r\n將1個友軍單位能力值變成4|4。",
    		descriptionRaw: "抽到此牌時，此牌本回合魔耗值-2。\r\n將1個友軍單位能力值變成4|4。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「碼頭那邊有麻煩！帶上這些，代我問候他們。」——首席機械師澤維",
    		artistName: "Kudos Productions",
    		name: "整裝待發",
    		cardCode: "02PZ003",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW031.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW031-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "對1個敵軍單位造成2點傷害。\r\n若擊殺該單位，則另外對敵方主堡造成4點傷害。",
    		descriptionRaw: "對1個敵軍單位造成2點傷害。\r\n若擊殺該單位，則另外對敵方主堡造成4點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我總是先發制人。」——好運姐",
    		artistName: "Kudos Productions",
    		name: "彈射",
    		cardCode: "02BW031",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW034T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW034.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW034-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 4,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：對此牌造成2點傷害並召喚1個<link=card.create><style=AssociatedCard>火藥猴群</style></link>。",
    		descriptionRaw: "回合開始：對此牌造成2點傷害並召喚1個火藥猴群。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「這是一個……紀念品，是從一個瘋瘋癲癲的老對頭手中奪過來的。那個白癡之前念念叨叨說著這東西蘊含『古代神秘力量』，看來還有點根據……」——好運姐",
    		artistName: "Kudos Productions",
    		name: "聖猴神像",
    		cardCode: "02BW034",
    		keywords: [
    			"定身"
    		],
    		keywordRefs: [
    			"Immobile"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02SI008",
    			"02SI008T1",
    			"02SI008T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI008T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02SI008T2-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 4,
    		health: 5,
    		description: "此牌升級時，<link=keyword.Obliterate><style=Keyword>泯滅</style></link>敵方牌組，只留下4張非英雄卡牌。\r\n<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：召喚1個<link=card.summon><style=AssociatedCard>小樹精</style></link>。",
    		descriptionRaw: "此牌升級時，泯滅敵方牌組，只留下4張非英雄卡牌。\r\n回合開始：召喚1個小樹精。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "他將消滅島嶼上的污穢，恢復其失去已久的生命。",
    		artistName: "SIXMOREVODKA",
    		name: "茂凱",
    		cardCode: "02SI008T2",
    		keywords: [
    			"再生"
    		],
    		keywordRefs: [
    			"Regeneration"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX010-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 6,
    		cost: 6,
    		health: 5,
    		description: "只有力量值5點或以上的敵軍單位才能對此牌造成傷害。 ",
    		descriptionRaw: "只有力量值5點或以上的敵軍單位才能對此牌造成傷害。 ",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「戰爭怪獸一旦啟動，便無人能擋。不想死就滾開吧。」——巨異蜥騎兵",
    		artistName: "Kudos Productions",
    		name: "披甲角獸騎兵",
    		cardCode: "02NX010",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE001-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "選擇1個敵軍單位，使2個友軍單位<link=vocab.Strike><style=Vocab>打擊</style></link>該單位。",
    		descriptionRaw: "選擇1個敵軍單位，使2個友軍單位打擊該單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「快過來，與我並肩作戰！」——綠牙守衛",
    		artistName: "Kudos Productions",
    		name: "協力打擊",
    		cardCode: "02DE001",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO007-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "使1個友軍單位將1個敵軍單位踢向敵方主堡，視為對兩者進行<link=vocab.Strike><style=Vocab>打擊</style></link>。\r\n若敵軍單位存活，則將其<link=keyword.Recall><style=Keyword>召回</style></link>。",
    		descriptionRaw: "使1個友軍單位將1個敵軍單位踢向敵方主堡，視為對兩者進行打擊。\r\n若敵軍單位存活，則將其召回。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「必須釋放巨龍，不然牠會從內心吞噬我。」——李星",
    		artistName: "Kudos Productions",
    		name: "神龍擺尾",
    		cardCode: "02IO007",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW029.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW029-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "2張牌，然後抽2張牌。",
    		descriptionRaw: "2張牌，然後抽2張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "船骸漂流物不會留在海面上太久的。稱職的船員得快速分辨哪些是高價貨物，哪些又是不重要的垃圾，因為很快一切就會沉入海底。",
    		artistName: "Kudos Productions",
    		name: "打撈",
    		cardCode: "02BW029",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW022"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW015.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW015-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 7,
    		health: 7,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：抽出1張<link=card.champ1><style=AssociatedCard>好運姐</style></link>。\r\n此牌攻擊時，我方所有法術與技能額外造成1點傷害。",
    		descriptionRaw: "出牌：抽出1張好運姐。\r\n此牌攻擊時，我方所有法術與技能額外造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "你不會認錯賽蓮號的，那巨幅的珍珠色船帆，那仔細雕琢的木工，散發華貴而俐落的形象，如同其上掌舵的船長。",
    		artistName: "SIXMOREVODKA",
    		name: "賽蓮號",
    		cardCode: "02BW015",
    		keywords: [
    			"先遣"
    		],
    		keywordRefs: [
    			"Scout"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW010-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "：隨機賦予此牌2種特性。",
    		descriptionRaw: "：隨機賦予此牌2種特性。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「那個貪心又殘忍的魔頭已經在懸賞令上好長一段時間了，礙事的人都被他不眨眼的處理掉囉。你問我最糟糕的是啥？就是他……長得還怪可愛的，可惡！」——剛普朗克",
    		artistName: "SIXMOREVODKA",
    		name: "大盜普羅",
    		cardCode: "02BW010",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "普羅",
    		subtypes: [
    			"普羅"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW009-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 1,
    		cost: 1,
    		health: 2,
    		description: "召喚此牌時，抽1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>牌。",
    		descriptionRaw: "召喚此牌時，抽1張飛逝牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「真是狗屁倒灶的鳥事，前面敲詐得正順手，怎麼就在最後栽了跟頭。唉，幸運女神又不想甩我了…」——惡賭徒",
    		artistName: "Dao Le",
    		name: "鼬詐老千",
    		cardCode: "02BW009",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW005-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "召喚此牌時，賦予<link=vocab.Strongest><style=Vocab>最強</style></link>敵軍<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>。",
    		descriptionRaw: "召喚此牌時，賦予最強敵軍弱勢。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你就長這個猴樣？夭壽喔，簡直比懸賞令上的還不堪入目，希望你的人頭值得我浪費時間。」",
    		artistName: "SIXMOREVODKA",
    		name: "受僱槍手",
    		cardCode: "02BW005",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW025",
    			"02BW046T3",
    			"02BW046T1",
    			"02BW046T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW046.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW046-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "施放法術時，給予此牌<link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>，並使以此牌為目標的所有法術和技能無效化。",
    		descriptionRaw: "施放法術時，給予此牌隱密，並使以此牌為目標的所有法術和技能無效化。",
    		levelupDescription: "我方於本牌局中施放6次或以上法術<style=Variable></style>。",
    		levelupDescriptionRaw: "我方於本牌局中施放6次或以上法術。",
    		flavorText: "比爾吉沃特的傳奇人物當中，飛斯的性格乖戾又難搞。一些水手將附近發生的無數船禍都怪罪於他……",
    		artistName: "SIXMOREVODKA",
    		name: "飛斯",
    		cardCode: "02BW046",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW049.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW049-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "從敵方牌組抽1張牌。\r\n：再抽1張牌。",
    		descriptionRaw: "從敵方牌組抽1張牌。\r\n：再抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "我的東西是我的，你的東西……也是我的。",
    		artistName: "Kudos Productions",
    		name: "盜品",
    		cardCode: "02BW049",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02FR005T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR005-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 4,
    		cost: 5,
    		health: 6,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：此牌幻化為<link=card.transform><style=AssociatedCard>風暴之爪巨熊</style></link>。",
    		descriptionRaw: "洗劫：此牌幻化為風暴之爪巨熊。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "巨熊族原是人類，不過他們放棄了本來備受禁錮的凡體，換來偉大神靈弗力貝爾所賜予的野性力量。",
    		artistName: "Kudos Productions",
    		name: "巨熊族靈魂行者",
    		cardCode: "02FR005",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW039.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW039-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 3,
    		health: 1,
    		description: "召喚此牌時，在手牌生成1張隨機海怪牌。",
    		descriptionRaw: "召喚此牌時，在手牌生成1張隨機海怪牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "財寶引誘無數水手出海，這些可憐的傢伙不久之後便會知曉大海有多可怕，以及為何倖存的人如此少。",
    		artistName: "SIXMOREVODKA",
    		name: "青囊魚獵人",
    		cardCode: "02BW039",
    		keywords: [
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW030T4"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW030T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW030T3-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "此牌遭到<link=vocab.Toss><style=Vocab>亂擲</style></link>時，反而會被抽出。\r\n召喚3個<link=card.summon><style=AssociatedCard>兇惡鎧龍</style></link>。",
    		descriptionRaw: "此牌遭到亂擲時，反而會被抽出。\r\n召喚3個兇惡鎧龍。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "灰髮船長高舉著發光的能量泉源，咆哮大喊：「我們將一輩子免受災禍。」水手們興高采烈地鼓譟，但他們的船邊，海水卻開始滾沸……",
    		artistName: "Kudos Productions",
    		name: "鎧龍蛋",
    		cardCode: "02BW030T3",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "寳藏",
    		subtypes: [
    			"寳藏"
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW006-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 4,
    		health: 2,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：幻化1個友軍單位，使其隨機變成1個不分陣營、魔耗值5的侍從單位。",
    		descriptionRaw: "出牌：幻化1個友軍單位，使其隨機變成1個不分陣營、魔耗值5的侍從單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「厲不厲害？我的……我的手上哪了？」\n「看好啦，我要再把它們變出來！搭啦！咳咳……搭啦！」\n「……我天殺的手去哪啦？！」\n「好吧，感謝觀看，你們該滾了！」",
    		artistName: "Kudos Productions",
    		name: "騙術士",
    		cardCode: "02BW006",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW046T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW046T2-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 5,
    		cost: 4,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "雖然飛斯的脾氣和意圖難以捉摸，但長牙獸的則一目了然。",
    		artistName: "SIXMOREVODKA",
    		name: "長牙獸",
    		cardCode: "02BW046T2",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02PZ008",
    			"02PZ008T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ008T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ008T2-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 10,
    		cost: 5,
    		health: 6,
    		description: "此牌在攻擊時，每<link=vocab.Strike><style=Vocab>打擊</style></link>1個單位，就對敵方主堡造成5點傷害。",
    		descriptionRaw: "此牌在攻擊時，每打擊1個單位，就對敵方主堡造成5點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「看來你的夥伴們都筋疲力盡了。要不供出你們把海克斯科技藏在哪，要不試試你的腦袋跟牆壁誰比較硬，你選哪個？」",
    		artistName: "SIXMOREVODKA",
    		name: "菲艾",
    		cardCode: "02PZ008T2",
    		keywords: [
    			"挑戰者",
    			"堅忍"
    		],
    		keywordRefs: [
    			"Challenger",
    			"Tough"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW026T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW026T2-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "恢復1點法術魔力。\r\n抽1張牌。",
    		descriptionRaw: "恢復1點法術魔力。\r\n抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「跟湖水一樣湛藍。」——逆命",
    		artistName: "Kudos Productions",
    		name: "藍色卡牌",
    		cardCode: "02BW026T2",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02DE006T2",
    			"02DE006T1",
    			"02DE006T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02DE006-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 5,
    		health: 4,
    		description: "召喚此牌時，召喚<link=card.create><style=AssociatedCard>威洛</style></link>。",
    		descriptionRaw: "召喚此牌時，召喚威洛。",
    		levelupDescription: "此牌在場上時我方攻擊4次<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌在場上時我方攻擊4次。",
    		flavorText: "「葵恩是一名勇敢無懼的遊騎兵，加上威洛在她身邊和天空中陪伴，這對拍檔無人能擋。」——游騎兵珍妮薇·艾姆哈特",
    		artistName: "SIXMOREVODKA",
    		name: "葵恩",
    		cardCode: "02DE006",
    		keywords: [
    			"先遣"
    		],
    		keywordRefs: [
    			"Scout"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW001-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "本回合給予1名敵軍單位<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>，若該單位於本回合陣亡，我方抽1張牌。",
    		descriptionRaw: "本回合給予1名敵軍單位弱勢，若該單位於本回合陣亡，我方抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「孩子們，抬頭挺胸打起精神！被船長發現你在打混就等著被大卸八塊餵海鷗吧，還不快給我動起來！」——恐懼號水手",
    		artistName: "Greg Faillace",
    		name: "警告過你囉",
    		cardCode: "02BW001",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO006",
    			"02IO006T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO006T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO006T2-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "使1個友軍單位將1個敵軍單位踢向敵方主堡，視為對兩者進行<link=vocab.Strike><style=Vocab>打擊</style></link>。\r\n若敵軍單位存活，則將其<link=keyword.Recall><style=Keyword>召回</style></link>。\r\n將1張<link=card.level1><style=AssociatedCard>李星</style></link>洗入我方牌組。",
    		descriptionRaw: "使1個友軍單位將1個敵軍單位踢向敵方主堡，視為對兩者進行打擊。\r\n若敵軍單位存活，則將其召回。\r\n將1張李星洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「必須釋放巨龍，不然牠會從內心吞噬我。」——李星",
    		artistName: "Kudos Productions",
    		name: "李星 神龍擺尾",
    		cardCode: "02IO006T2",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO010T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO010T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "從手牌召喚1個魔耗值3或以下的友軍單位。",
    		descriptionRaw: "從手牌召喚1個魔耗值3或以下的友軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "……並以驚人的速度重整旗鼓。倖存者集結軍勢、擁立軍帥，並讓侵略者一嘗最初淨土的頑強精神。",
    		artistName: "Kudos Productions",
    		name: "打道回府",
    		cardCode: "02IO010T1",
    		keywords: [
    			"飛逝",
    			"疾速"
    		],
    		keywordRefs: [
    			"Fleeting",
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW026T4.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW026T4-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對所有敵軍單位和敵方主堡造成1點傷害。",
    		descriptionRaw: "對所有敵軍單位和敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「見者有分。」——逆命",
    		artistName: "Kudos Productions",
    		name: "紅色卡牌",
    		cardCode: "02BW026T4",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO009-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "若上回合我方已施放2次或以上法術，則此牌魔耗值-2。\r\n抽2張其他法術牌。\r\n",
    		descriptionRaw: "若上回合我方已施放2次或以上法術，則此牌魔耗值-2。\r\n抽2張其他法術牌。\r\n",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "靜心冥想無法預設目的，必須在過程中迷失，才能尋得其道。",
    		artistName: "Kudos Production",
    		name: "深度冥想",
    		cardCode: "02IO009",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW063.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW063-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "：從敵方手牌隨機抽1張非英雄牌。",
    		descriptionRaw: "：從敵方手牌隨機抽1張非英雄牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「打牌不看運氣，而是看人。成功讓對手懷疑自己，他們的一切就屬於你了。」——逆命",
    		artistName: "Kudos Productions",
    		name: "障眼法",
    		cardCode: "02BW063",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW036.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW036-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 3,
    		health: 4,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "傳說有一隻白色的帶角鯨魚偷取了倒刺女神的東西。倒刺女神於是懲罰這隻貪婪的生物，以一層閃閃發亮的黃金覆蓋牠，讓牠終日受到他人貪念的荼毒。",
    		artistName: "SIXMOREVODKA",
    		name: "黃金獨角鯨",
    		cardCode: "02BW036",
    		keywords: [
    			"隱密",
    			"弱勢"
    		],
    		keywordRefs: [
    			"Elusive",
    			"Vulnerable"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW045.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW045-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "隨機對3個敵軍單位造成1點傷害。",
    		descriptionRaw: "隨機對3個敵軍單位造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「火力全開！」——好運姐",
    		artistName: "Kudos Productions",
    		name: "槍林彈雨",
    		cardCode: "02BW045",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW033.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW033-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：從敵方牌組抽1張牌。\r\n抽敵方卡牌時，該卡牌魔耗值-1。",
    		descriptionRaw: "洗劫：從敵方牌組抽1張牌。\r\n抽敵方卡牌時，該卡牌魔耗值-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「這裡應有盡有！還有一些『特別』貨色……記住，不要說是我賣給你的！」",
    		artistName: "SIXMOREVODKA",
    		name: "黑市商人",
    		cardCode: "02BW033",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX004T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX004T1-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對1個友軍單位造成1點傷害後，對敵方主堡造成2點傷害。",
    		descriptionRaw: "對1個友軍單位造成1點傷害後，對敵方主堡造成2點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "為了取得戰略性的勝利，使用火藥所帶來的風險，簡直微不足道。",
    		artistName: "Kudos Productions",
    		name: "火藥手雷",
    		cardCode: "02NX004T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW060T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW060T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對敵方主堡造成1點傷害。",
    		descriptionRaw: "對敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「船長下令：射爆他們的頭！」——神射海盜",
    		artistName: "Kudos Productions",
    		name: "神射手",
    		cardCode: "02BW060T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02PZ008",
    			"02PZ008T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ008T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ008T1-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予1個友軍單位+2|+0。\r\n在手牌生成1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.selfRef><style=AssociatedCard>蓄能衝擊</style></link>。\r\n將1張<link=card.level1><style=AssociatedCard>菲艾</style></link>洗入我方牌組。",
    		descriptionRaw: "本回合給予1個友軍單位+2|+0。\r\n在手牌生成1張飛逝蓄能衝擊。\r\n將1張菲艾洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我的雙臂代我說話。」——菲艾",
    		artistName: "Kudos Productions",
    		name: "菲艾 蓄能衝擊",
    		cardCode: "02PZ008T1",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW020-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對敵方主堡造成1點傷害。",
    		descriptionRaw: "對敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「老兄，你應該要跟我們一起開火的！懂不懂什麼叫做全體開炮啊！」——肖狗水手",
    		artistName: "Kudos Productions",
    		name: "警告射擊",
    		cardCode: "02BW020",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX008-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "對1個敵軍單位造成2點傷害後，對敵方主堡造成1點傷害。",
    		descriptionRaw: "對1個敵軍單位造成2點傷害後，對敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「起碼也死得有尊嚴一點吧。」——斯溫",
    		artistName: "Kudos Productions",
    		name: "靈魂拷問",
    		cardCode: "02NX008",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02PZ005-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 4,
    		cost: 3,
    		health: 3,
    		description: "抽到此牌時，本回合此牌魔耗值-1。",
    		descriptionRaw: "抽到此牌時，本回合此牌魔耗值-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "米爾警官奔跑的模樣是隊上常出現的笑梗，不過凱普警官總是聽不懂。",
    		artistName: "SIXMOREVODKA",
    		name: "巡邏員警",
    		cardCode: "02PZ005",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02NX005-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 4,
    		cost: 3,
    		health: 3,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「只要有好的武器，攻城易如反掌。投石機能夠引誘他們出城；弩砲車則能夠將他們擊倒。」——圍城技師",
    		artistName: "Kudos Productions",
    		name: "幽鐵弩砲",
    		cardCode: "02NX005",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR006-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 2,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "冬之爪在弗雷爾卓德無人能比，而且這些無情劫掠者的兇猛性格眾所皆知，一旦他們被嗜血狂怒沖昏頭腦，他們的對手只能祈求自己死得痛快。",
    		artistName: "Kudos Production",
    		name: "無情劫掠者",
    		cardCode: "02FR006",
    		keywords: [
    			"勢不可擋",
    			"堅忍"
    		],
    		keywordRefs: [
    			"Overwhelm",
    			"Tough"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW046",
    			"02BW046T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW046T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW046T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "從戰鬥中移除1個攻擊中的友軍單位，然後進行<link=vocab.Rally><style=Vocab>備戰</style></link>。\r\n將1張<link=card.level1><style=AssociatedCard>飛斯</style></link>洗入我方牌組。",
    		descriptionRaw: "從戰鬥中移除1個攻擊中的友軍單位，然後進行備戰。\r\n將1張飛斯洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「快你一步！」——飛斯",
    		artistName: "Max Grecke",
    		name: "飛斯 調皮小飛",
    		cardCode: "02BW046T1",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW053",
    			"02BW053T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW053T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW053T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 13,
    		cost: 7,
    		health: 13,
    		description: "我方海怪魔耗值-4。",
    		descriptionRaw: "我方海怪魔耗值-4。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "雖然形式可能有所不同，但最終所有人都會付出代價。",
    		artistName: "SIXMOREVODKA",
    		name: "納帝魯斯",
    		cardCode: "02BW053T1",
    		keywords: [
    			"堅忍",
    			"威嚇"
    		],
    		keywordRefs: [
    			"Tough",
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW044.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02BW044-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "4張牌。",
    		descriptionRaw: "4張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「沒有價值的東西，就會被拋進大海，包括你們在內。快點去幹活吧！」——肖狗水手",
    		artistName: "Kudos Productions",
    		name: "海難投棄",
    		cardCode: "02BW044",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO008T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02IO008-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "本回合給予1個友軍單位<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。\r\n在手牌生成1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.secondSpell><style=AssociatedCard>震驚百里</style></link>。",
    		descriptionRaw: "本回合給予1個友軍單位挑戰者。\r\n在手牌生成1張飛逝震驚百里。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「克己復禮……」——李星",
    		artistName: "Kudos Productions",
    		name: "虎嘯龍吟",
    		cardCode: "02IO008",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR016"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set2/zh_tw/img/cards/02FR003-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "隨機生成2張不分區域的普羅牌與2張<link=card.snaxRef><style=AssociatedCard>普羅點心</style></link>。",
    		descriptionRaw: "隨機生成2張不分區域的普羅牌與2張普羅點心。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「當你仰望夜空，\n向普羅許願時，\n便會看到點心\n在群星之中閃閃發亮。」——青年英格瓦",
    		artistName: "Kudos Productions",
    		name: "普羅極光",
    		cardCode: "02FR003",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	}
    ];

    var set1 = [
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO012T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO012T2-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予1個友軍單位+0|+3。",
    		descriptionRaw: "本回合給予1個友軍單位+0|+3。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "",
    		artistName: "SIXMOREVODKA",
    		name: "堅韌之戒律",
    		cardCode: "01IO012T2",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX020T1",
    			"01NX020T2",
    			"01NX020"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX020T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX020T3-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 4,
    		cost: 3,
    		health: 4,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>或<link=vocab.Strike><style=Vocab>打擊</style></link>：在手牌生成2張<link=card.create><style=AssociatedCard>迴旋飛斧</style></link>。",
    		descriptionRaw: "出牌或打擊：在手牌生成2張迴旋飛斧。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我誰！」",
    		artistName: "SIXMOREVODKA",
    		name: "達瑞文",
    		cardCode: "01NX020T3",
    		keywords: [
    			"快速攻擊",
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"QuickStrike",
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE031.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE031-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 1,
    		cost: 3,
    		health: 4,
    		description: "<link=vocab.RoundEnd><style=Vocab>回合結束</style></link>：若有友軍單位於本回合陣亡，則賦予其他友軍單位+1|+1。",
    		descriptionRaw: "回合結束：若有友軍單位於本回合陣亡，則賦予其他友軍單位+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「邪惡勢力贏得了一時，卻贏不了一世。緬懷為我們捐軀的人，將他們的回憶當作盔甲披在身上！」",
    		artistName: "SIXMOREVODKA",
    		name: "拂曉申言者",
    		cardCode: "01DE031",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ040",
    			"01PZ040T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ040T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ040T3-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "棄置1張牌即可出此牌。對任一目標造成3點傷害。\r\n將1張<link=card.level1><style=AssociatedCard>吉茵珂絲</style></link>洗入我方牌組。",
    		descriptionRaw: "棄置1張牌即可出此牌。對任一目標造成3點傷害。\r\n將1張吉茵珂絲洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「大火力登場！」——吉茵珂絲",
    		artistName: "Original Force",
    		name: "吉茵珂絲 狂躁！",
    		cardCode: "01PZ040T3",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR024",
    			"01FR024T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR024T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR024T2-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對所有敵軍單位和敵方主堡造成1點傷害。",
    		descriptionRaw: "對所有敵軍單位和敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "寧靜前的暴風雨。",
    		artistName: "SIXMOREVODKA",
    		name: "冰川風暴",
    		cardCode: "01FR024T2",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ008",
    			"01PZ022",
    			"01PZ008T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ008T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ008T2-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 1,
    		health: 2,
    		description: "<link=vocab.Nexus Strike><style=Vocab>打擊主堡</style></link>：使敵方牌組的<link=card.shuffle><style=AssociatedCard>劇毒膨菇</style></link>數量加倍。",
    		descriptionRaw: "打擊主堡：使敵方牌組的劇毒膨菇數量加倍。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「...記得離開爆炸範圍！」",
    		artistName: "SIXMOREVODKA",
    		name: "提摩",
    		cardCode: "01PZ008T2",
    		keywords: [
    			"隱密"
    		],
    		keywordRefs: [
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE038",
    			"01DE022T1",
    			"01DE022T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE022-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "此牌在場上時，有4個或以上友軍單位陣亡，或<link=card.senna><style=AssociatedCard>光之哨兵姍娜</style></link>陣亡<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌在場上時，有4個或以上友軍單位陣亡，或光之哨兵姍娜陣亡。",
    		flavorText: "「姍娜，只要有你在，我就會好好的。」",
    		artistName: "SIXMOREVODKA",
    		name: "路西恩",
    		cardCode: "01DE022",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO015",
    			"01IO015T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO015T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO015T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 5,
    		cost: 4,
    		health: 5,
    		description: "我方<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>或<link=keyword.Recall><style=Keyword>召回</style></link>1個敵軍單位時，此牌會打擊該牌。",
    		descriptionRaw: "我方擊暈或召回1個敵軍單位時，此牌會打擊該牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「...永遠伴我左右、供我驅策。」",
    		artistName: "SIXMOREVODKA",
    		name: "犽宿",
    		cardCode: "01IO015T1",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ056T10",
    			"01PZ056T3",
    			"01PZ056T1",
    			"01PZ056T4",
    			"01PZ056T7",
    			"01PZ056T6",
    			"01PZ056T8",
    			"01PZ056T2",
    			"01PZ056T9",
    			"01PZ056T5",
    			"01PZ015"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 5,
    		health: 3,
    		description: "施放法術時，在手牌生成1張相同魔耗值的<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>砲臺。本回合給予該牌+1|+1且魔耗值為0。",
    		descriptionRaw: "施放法術時，在手牌生成1張相同魔耗值的飛逝砲臺。本回合給予該牌+1|+1且魔耗值為0。",
    		levelupDescription: "此牌在場上時我方召喚力量值共計12點或以上的砲臺<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌在場上時我方召喚力量值共計12點或以上的砲臺。",
    		flavorText: "「瘋狂科學家？哼！我明明是『超級正常只不過偶爾缺乏條理又不拘一格』的科學家好嗎？謝謝再見！」",
    		artistName: "SIXMOREVODKA",
    		name: "漢默丁格",
    		cardCode: "01PZ056",
    		keywords: [
    			"灌輸"
    		],
    		keywordRefs: [
    			"Imbue"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO020-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "召喚此牌時，本回合給予其他友軍單位+1|+0。",
    		descriptionRaw: "召喚此牌時，本回合給予其他友軍單位+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「從今而後，你代表戒律、訓練、謙遜與平衡。就在今日，你成為『均衡』的一員了。」",
    		artistName: "SIXMOREVODKA",
    		name: "面具看守者",
    		cardCode: "01IO020",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR039",
    			"01FR039T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR039T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR039T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "賦予1個友軍單位+8|+4。\r\n將1張<link=card.level1><style=AssociatedCard>泰達米爾</style></link>洗入牌組。",
    		descriptionRaw: "賦予1個友軍單位+8|+4。\r\n將1張泰達米爾洗入牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「他們說，我這個人……性情剛烈。」——泰達米爾",
    		artistName: "SIXMOREVODKA",
    		name: "泰達米爾 戰鬥狂怒",
    		cardCode: "01FR039T1",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ013T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ013.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ013-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 6,
    		health: 3,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：棄置所有手牌後抽3張牌，並對1個敵軍單位造成3點傷害。",
    		descriptionRaw: "出牌：棄置所有手牌後抽3張牌，並對1個敵軍單位造成3點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "為了完成夢想，他斷送了雙手，卻仍努力不懈。任何事都無法阻止他的野心。",
    		artistName: "SIXMOREVODKA",
    		name: "自我強化科學家",
    		cardCode: "01PZ013",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE019-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "使手牌中友軍單位魔耗值-1。",
    		descriptionRaw: "使手牌中友軍單位魔耗值-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「只要訓練兩週，農民也能上前線作戰。這是我們對每位體格健壯的蒂瑪西亞子民的期望。」——蓋倫",
    		artistName: "Kudos Productions",
    		name: "組織動員",
    		cardCode: "01DE019",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX004-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "擊殺1個力量值3或以下的單位。",
    		descriptionRaw: "擊殺1個力量值3或以下的單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "人難免一死，只不過弱者比較早死。",
    		artistName: "Rafael Zanchetin",
    		name: "天擇刎頸殺",
    		cardCode: "01NX004",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ007-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 3,
    		health: 4,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：為此牌支援的友軍單位生成4張複製牌並洗入我方牌組。",
    		descriptionRaw: "支援：為此牌支援的友軍單位生成4張複製牌並洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "人群被大砲轟炸聲引來廣場，熱切想觀賞表演。他們八成要花好幾週才能把纏在髮間的彩紙洗掉。",
    		artistName: "SIXMOREVODKA",
    		name: "電光遊行花車",
    		cardCode: "01PZ007",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ056T3",
    			"01PZ056T1",
    			"01PZ056T4",
    			"01PZ056T7",
    			"01PZ056T6",
    			"01PZ056T8",
    			"01PZ056T2",
    			"01PZ056T9",
    			"01PZ056T5",
    			"01PZ015",
    			"01PZ056"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T10.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T10-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 5,
    		health: 4,
    		description: "施放法術時，在手牌生成1張相同魔耗值的<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>砲臺。本回合給予該牌+1|+1且魔耗值為0。",
    		descriptionRaw: "施放法術時，在手牌生成1張相同魔耗值的飛逝砲臺。本回合給予該牌+1|+1且魔耗值為0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「不斷進步！！！」",
    		artistName: "SIXMOREVODKA",
    		name: "漢默丁格",
    		cardCode: "01PZ056T10",
    		keywords: [
    			"灌輸"
    		],
    		keywordRefs: [
    			"Imbue"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI038.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI038-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 3,
    		health: 3,
    		description: "每有一其它友軍單位陣亡，則對敵方主堡造成1點傷害。",
    		descriptionRaw: "每有一其它友軍單位陣亡，則對敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "最殘酷的不是她裝成哭泣的小女孩誘殺士兵，而是她在生還的士兵心中深植恐懼，讓他們回到家後對他們自己女兒的哭鬧置之不理。",
    		artistName: "SIXMOREVODKA",
    		name: "魅影搗蛋鬼",
    		cardCode: "01SI038",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE042",
    			"01DE042T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE042T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE042T1-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予1個友軍單位<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。\r\n將1張<link=card.level1><style=AssociatedCard>拉克絲</style></link>洗入我方牌組。",
    		descriptionRaw: "本回合給予1個友軍單位光盾。\r\n將1張拉克絲洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「當你與眾不同，全世界都會跟你作對。有人說，你的不同之處會成為弱點，其實你只會更加堅強且富有同情心。再黑暗的時刻，都有我保護你！」——拉克絲",
    		artistName: "Kudos Productions",
    		name: "拉克絲 稜光障壁",
    		cardCode: "01DE042T1",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ018-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 2,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "她是怎麼瞄準的？這是個好問題。",
    		artistName: "SIXMOREVODKA",
    		name: "菁英學院奇才",
    		cardCode: "01PZ018",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO045.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO045-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：本回合給予此牌支援的友軍單位<link=keyword.Lifesteal><sprite name=Lifesteal><style=Keyword>吸血</style></link>。",
    		descriptionRaw: "支援：本回合給予此牌支援的友軍單位吸血。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「冬季支配大地之際，\n陣陣腳步踏上雪地。\n悠悠甦醒之時，枝頭冒出藤蔓嫩葉\n遍覆森林，預示季節的更迭。」\n——尚禪詩歌",
    		artistName: "SIXMOREVODKA",
    		name: "春臨信使",
    		cardCode: "01IO045",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO008-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 2,
    		health: 3,
    		description: "每當我方<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>或<link=keyword.Recall><style=Keyword>召回</style></link>1個單位，賦予此牌+2|+0。",
    		descriptionRaw: "每當我方擊暈或召回1個單位，賦予此牌+2|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「喔，你覺得我很『可愛』？『毛茸茸』？？那你看看這招是不是讓你『愛死了』！」",
    		artistName: "SIXMOREVODKA",
    		name: "旋刃者．飛",
    		cardCode: "01IO008",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX030",
    			"01NX005",
    			"01NX048",
    			"01NX032"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX048.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX048-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "此牌承受傷害且未陣亡時，在手牌隨機生成1張血色單位。",
    		descriptionRaw: "此牌承受傷害且未陣亡時，在手牌隨機生成1張血色單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「最親愛的夥伴們！」「當然，這一天我期盼好久了。」「沒關係，只要能參加，要怎麼整我都行。」「雨天就不能舉辦露天舞會了！那就太掃興了。」「嗚，我莫名其妙被罵了。那你呢？凱？你會參加嗎？」",
    		artistName: "SIXMOREVODKA",
    		name: "血色督察",
    		cardCode: "01NX048",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR006-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "挑選1個友軍單位，賦予我方<link=vocab.Everywhere><style=Vocab>各處</style></link>與之相同的單位與卡牌+2|+2。",
    		descriptionRaw: "挑選1個友軍單位，賦予我方各處與之相同的單位與卡牌+2|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們是少數的寒霜之裔，吾族血脈流淌著弗雷爾卓德的魔法。祖先們將古老的邪惡封印起來，現在碩果僅存的我們必須保持警戒，提防邪惡勢力捲土重來。」——守護者葛瑞戈",
    		artistName: "SIXMOREVODKA",
    		name: "寒霜之裔的傳承",
    		cardCode: "01FR006",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO022-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "本回合給予1個友軍單位<link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>。",
    		descriptionRaw: "本回合給予1個友軍單位隱密。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「即刻出發，保持隱匿……任務完成之前不許回來。」——劫",
    		artistName: "Kudos Productions",
    		name: "鬼步",
    		cardCode: "01IO022",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR022-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "召喚此牌時，賦予牌組最上方2個友軍單位+1|+1。",
    		descriptionRaw: "召喚此牌時，賦予牌組最上方2個友軍單位+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「掠奪者曾三次進逼至艾伐洛森的大門，每次總會遇到箭在弦上對準我們的窘境。他們到底耍了什麼花招，能屢次察覺進攻？」——戰痕族長史特芬",
    		artistName: "SIXMOREVODKA",
    		name: "警示鷹",
    		cardCode: "01FR022",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR042.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR042-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>2個敵軍單位。 ",
    		descriptionRaw: "凍傷2個敵軍單位。 ",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你竟敢在我的地盤挑戰我？小子，你根本是來送死。」——艾妮維亞",
    		artistName: "Kudos Productions",
    		name: "嚴寒狂風",
    		cardCode: "01FR042",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI049.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI049-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "擊殺1個友軍單位，然後抽2張牌。",
    		descriptionRaw: "擊殺1個友軍單位，然後抽2張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我犯了大錯，我們根本不該妄想窺視那片灰霧背後的世界。無論那裡藏著什麼樣的知識，要付出的代價實在太大了。」——無畏守備官，阿里．倫斯",
    		artistName: "Kudos Productions",
    		name: "窺視異域",
    		cardCode: "01SI049",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI002",
    			"01SI053",
    			"01SI053T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI053T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI053T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "若本回合1個友軍單位陣亡，召喚2個<link=card.create><style=AssociatedCard>小蜘蛛</style></link>。\r\n將1張<link=card.level1><style=AssociatedCard>伊莉絲</style></link>洗入我方牌組。",
    		descriptionRaw: "若本回合1個友軍單位陣亡，召喚2個小蜘蛛。\r\n將1張伊莉絲洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "嚇到起雞皮疙瘩很可怕？你還沒嘗過打從心底感到毛骨悚然的滋味。",
    		artistName: "Kudos Productions",
    		name: "伊莉絲 寒毛直豎",
    		cardCode: "01SI053T1",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR009T1",
    			"01FR009T2",
    			"01FR053"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR009-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 3,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "此牌共承受10點傷害並存活<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌共承受10點傷害並存活。",
    		flavorText: "「把拔，跟我說布郎姆和他的巨石門的故事嘛！」\n「或是他在下墜時，把山峰一分為二的那段！」\n「喔！不然說說他保護小酒館免受暴怒雪怪破壞的故事吧？！」",
    		artistName: "SIXMOREVODKA",
    		name: "布郎姆",
    		cardCode: "01FR009",
    		keywords: [
    			"挑戰者",
    			"再生"
    		],
    		keywordRefs: [
    			"Challenger",
    			"Regeneration"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI057.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI057-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 7,
    		cost: 4,
    		health: 7,
    		description: "擊殺2個友軍單位即可出此牌。",
    		descriptionRaw: "擊殺2個友軍單位即可出此牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「全部關進籠子，答啦答……\n奪走所有魂魄，啦答啦……\n別放他們走，萬萬不能！\n否則這些魂魄會激動翻騰……」",
    		artistName: "JiHun Lee",
    		name: "古代鱷龍",
    		cardCode: "01SI057",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE010-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 5,
    		cost: 5,
    		health: 4,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：在手牌隨機生成1張菁英牌。",
    		descriptionRaw: "遺願：在手牌隨機生成1張菁英牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「唯有勇猛無畏的戰士，才敢將性命交付給銀翼鷲，在高空與敵人纏鬥。這群戰士不僅勇猛，耐力也極高。」——蓋倫",
    		artistName: "SIXMOREVODKA",
    		name: "銀翼鷲槍騎兵",
    		cardCode: "01DE010",
    		keywords: [
    			"遺願",
    			"挑戰者"
    		],
    		keywordRefs: [
    			"LastBreath",
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI023.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI023-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "召喚<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>友軍單位時，賦予其+1|+1。",
    		descriptionRaw: "召喚閃靈友軍單位時，賦予其+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "唯有亡者知道她並非獨行。只有他們看得見她引領著無數同路人前往彼岸的國度。",
    		artistName: "SIXMOREVODKA",
    		name: "牧靈者",
    		cardCode: "01SI023",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ019-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 2,
    		health: 1,
    		description: "召喚此牌時，恢復2點法術魔力。",
    		descriptionRaw: "召喚此牌時，恢復2點法術魔力。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "不是每個人都能立刻為皮爾托福帶來進步。有些人需要一些提點，好比說，那些用錯透鏡還仔細拉近焦距猛看的傢伙。",
    		artistName: "SIXMOREVODKA",
    		name: "勤奮的學徒",
    		cardCode: "01PZ019",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX038T2",
    			"01NX038T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX038.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX038-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 6,
    		cost: 6,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "此牌在場上時敵方主堡生命值為10以下。",
    		levelupDescriptionRaw: "此牌在場上時敵方主堡生命值為10以下。",
    		flavorText: "「鋼鐵般的意志，媲美泰坦巨人的力量。特菲利安軍團沒有更優秀的將軍人選了。」——傑利科．斯溫\n",
    		artistName: "SIXMOREVODKA",
    		name: "達瑞斯",
    		cardCode: "01NX038",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO040.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO040-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 4,
    		health: 2,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「此處曾經是我們的學校、寺廟、家園。如今我們只能潛伏於暗影滿佈的廢墟。劫的軍團玷汙這片莊嚴之地；我保證會讓他們後悔莫及。」",
    		artistName: "SIXMOREVODKA",
    		name: "均衡奪命劍客",
    		cardCode: "01IO040",
    		keywords: [
    			"吸血",
    			"隱密"
    		],
    		keywordRefs: [
    			"Lifesteal",
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR018-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "<link=vocab.Strike><style=Vocab>打擊</style></link>：若此牌打擊力量值0的單位，則視同擊殺之。",
    		descriptionRaw: "打擊：若此牌打擊力量值0的單位，則視同擊殺之。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "北方的掠食性動物發現，那些遭受寒冬蹂躪的獵物是最容易得手的目標。",
    		artistName: "SIXMOREVODKA",
    		name: "冰霜尖牙狼",
    		cardCode: "01FR018",
    		keywords: [
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE020-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們雖不知道所面對的敵人或生物究竟是何物。但我們能認清身旁同袍的臉龐已足矣。」",
    		artistName: "SIXMOREVODKA",
    		name: "先鋒守軍",
    		cardCode: "01DE020",
    		keywords: [
    			"堅忍"
    		],
    		keywordRefs: [
    			"Tough"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "菁英",
    		subtypes: [
    			"菁英"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE034.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE034-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "召喚菁英單位時，賦予該單位+1|+1。",
    		descriptionRaw: "召喚菁英單位時，賦予該單位+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "戰爭勝負早在鑄造武器的那一刻就注定了。",
    		artistName: "SIXMOREVODKA",
    		name: "武器鐵匠",
    		cardCode: "01DE034",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE002-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 7,
    		cost: 8,
    		health: 7,
    		description: "召喚此牌時，進行<link=vocab.Rally><style=Vocab>備戰</style></link>。",
    		descriptionRaw: "召喚此牌時，進行備戰。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們的家族為這王國灑下熱血。妳不該為了那些不正經的光魔法而捨棄家族榮耀。」",
    		artistName: "SIXMOREVODKA",
    		name: "塔蒂雅娜．皇冠守衛",
    		cardCode: "01DE002",
    		keywords: [
    			"堅忍"
    		],
    		keywordRefs: [
    			"Tough"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX023.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX023-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 5,
    		cost: 5,
    		health: 3,
    		description: "召喚此牌時，賦予我方其他蜘蛛單位+2|+0。",
    		descriptionRaw: "召喚此牌時，賦予我方其他蜘蛛單位+2|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "只消瞟一眼，你便成了她的囊中物。只消咬一口，你便成了牠們的牙下亡魂。",
    		artistName: "SIXMOREVODKA",
    		name: "群蛛之主",
    		cardCode: "01NX023",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "蜘蛛",
    		subtypes: [
    			"蜘蛛"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO041",
    			"01IO041T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO041T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO041T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 5,
    		cost: 5,
    		health: 4,
    		description: "我方打出法術時，可對相同目標再次施放。",
    		descriptionRaw: "我方打出法術時，可對相同目標再次施放。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們會不計任何代價，為愛歐尼亞帶來和平。」",
    		artistName: "SIXMOREVODKA",
    		name: "卡瑪",
    		cardCode: "01IO041T1",
    		keywords: [
    			"灌輸"
    		],
    		keywordRefs: [
    			"Imbue"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE012",
    			"01DE012T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE012T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE012T1-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 6,
    		cost: 5,
    		health: 6,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：進行<link=vocab.Rally><style=Vocab>備戰</style></link>。",
    		descriptionRaw: "回合開始：進行備戰。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你覺得我頑固、偏執又墨守成規。我頑固，是因為沒有事物能動搖我。我偏執，是因為我相信蒂瑪西亞。至於墨守成規，是因為我的成規保證了你的失敗。」",
    		artistName: "SIXMOREVODKA",
    		name: "蓋倫",
    		cardCode: "01DE012T1",
    		keywords: [
    			"再生"
    		],
    		keywordRefs: [
    			"Regeneration"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "菁英",
    		subtypes: [
    			"菁英"
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE017-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "若場上僅有1名友軍單位，則賦予其+3|+3。",
    		descriptionRaw: "若場上僅有1名友軍單位，則賦予其+3|+3。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "當其他人倒下，真正的英雄必須擔負起開闢勝利之路的重責大任。",
    		artistName: "Kudos Productions",
    		name: "一夫當關",
    		cardCode: "01DE017",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ040T2",
    			"01PZ040T1",
    			"01PZ040T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ040.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ040-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 4,
    		cost: 4,
    		health: 3,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "此牌在場上時我方用盡手牌。",
    		levelupDescriptionRaw: "此牌在場上時我方用盡手牌。",
    		flavorText: "「怎麼啦，惡鯊？」\n「我好擔心你喔，吉茵珂絲！每次你無聊就會想要...」\n「想要來個大轟炸！惡鯊，這真是好主意！」",
    		artistName: "SIXMOREVODKA",
    		name: "吉茵珂絲",
    		cardCode: "01PZ040",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX013.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX013-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>1個敵軍單位。本回合給予所有友軍單位+2|+0。",
    		descriptionRaw: "擊暈1個敵軍單位。本回合給予所有友軍單位+2|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「隨便一名蠢蛋都能以壓倒性兵力戰勝敵軍。惟有遠見的人才懂得隱藏實力，留待關鍵時刻出擊。」——傑利科．斯溫",
    		artistName: "Original Force",
    		name: "致命出擊",
    		cardCode: "01NX013",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE045T1",
    			"01DE045T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE045.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE045-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "此卡牌擊殺2個敵軍<style=Variable></style>。",
    		levelupDescriptionRaw: "此卡牌擊殺2個敵軍。",
    		flavorText: "「不論是單場競技或比武大會，私下過招或上陣對敵，我都衷心期盼遇上一位夠格的對手。直到成為最強之前，我絕不停歇。」",
    		artistName: "SIXMOREVODKA",
    		name: "菲歐拉",
    		cardCode: "01DE045",
    		keywords: [
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ022"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ025.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ025-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "我方施放法術時，將3張<link=card.shuffle><style=AssociatedCard>劇毒膨菇</style></link>隨機植入敵方牌組。",
    		descriptionRaw: "我方施放法術時，將3張劇毒膨菇隨機植入敵方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「這批貨純嗎？」\n「當然！全是頂級貨！我親自跟它們談過了！」\n「好，給我——你說什麼？」\n「嗯哼！這傢伙就要結婚了！」\n「你嗑了多少……？」\n「——它要跟藤壺結婚！」",
    		artistName: "SIXMOREVODKA",
    		name: "膨菇小販",
    		cardCode: "01PZ025",
    		keywords: [
    			"灌輸"
    		],
    		keywordRefs: [
    			"Imbue"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE052.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE052-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 9,
    		cost: 9,
    		health: 9,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>或<link=vocab.Attack><style=Vocab>攻擊</style></link>：本回合給予所有友軍單位<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。",
    		descriptionRaw: "出牌或攻擊：本回合給予所有友軍單位光盾。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「這陣型是我們諸多戰術的基礎，所有士兵都必須對自己以及戰友手中的盾牌堅信不移。只要他們屹立不搖，王國便可長盛不衰。」——蓋倫\n",
    		artistName: "SIXMOREVODKA",
    		name: "閃鋼陣型",
    		cardCode: "01DE052",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ040T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ040T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ040T2-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "對敵方主堡造成4點傷害，並對所有其他敵軍單位造成1點傷害。<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。",
    		descriptionRaw: "對敵方主堡造成4點傷害，並對所有其他敵軍單位造成1點傷害。飛逝。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「再見啦！」——吉茵珂絲",
    		artistName: "Ben Skutt",
    		name: "超威能死亡火箭！",
    		cardCode: "01PZ040T2",
    		keywords: [
    			"慢速",
    			"飛逝"
    		],
    		keywordRefs: [
    			"Slow",
    			"Fleeting"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI053T2",
    			"01SI053T1",
    			"01SI002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI053.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI053-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：召喚1個攻擊中的<link=card.summon><style=AssociatedCard>小蜘蛛</style></link>。",
    		descriptionRaw: "攻擊：召喚1個攻擊中的小蜘蛛。",
    		levelupDescription: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：我方場上有3個或更多其他蜘蛛單位。",
    		levelupDescriptionRaw: "回合開始：我方場上有3個或更多其他蜘蛛單位。",
    		flavorText: "伊莉絲曾是諾克薩斯有權有勢家族的女主人，她與闇影島結下密不可分的關係，從中獲得永生的年輕美貌，代價是獻上幾個無辜靈魂作為祭品。她不假思索就答應了。",
    		artistName: "SIXMOREVODKA",
    		name: "伊莉絲",
    		cardCode: "01SI053",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "蜘蛛",
    		subtypes: [
    			"蜘蛛"
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE021.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE021-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "進行<link=vocab.Rally><style=Vocab>備戰</style></link>。",
    		descriptionRaw: "進行備戰。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: " 「每個人終要面對內心最深層的恐懼。算你幸運，因為我來了。」——路西恩\n",
    		artistName: "Max Grecke",
    		name: "冷酷進擊",
    		cardCode: "01DE021",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ048T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ048T1-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "<link=keyword.Obliterate><style=Keyword>泯滅</style></link>我方牌組前5張牌，其中每張法術可對所有敵軍造成1點傷害。",
    		descriptionRaw: "泯滅我方牌組前5張牌，其中每張法術可對所有敵軍造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我告訴他們，每項成就背後都有代價。我沒說是誰要付出代價。」——可瑞娜．瓦拉撒",
    		artistName: "Kudos Productions",
    		name: "曠世巨作",
    		cardCode: "01PZ048T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX046T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX046T1-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>1個敵軍單位。",
    		descriptionRaw: "擊暈1個敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "這不是他想像中的那種親吻。",
    		artistName: "Kudos Productions",
    		name: "麻痺嚙咬",
    		cardCode: "01NX046T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX047.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX047-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "對1個友軍單位造成1點傷害後，本回合給予另一個友軍單位+2|+2。",
    		descriptionRaw: "對1個友軍單位造成1點傷害後，本回合給予另一個友軍單位+2|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「親愛的，有得就有失。我得，你失。」——弗拉迪米爾",
    		artistName: "SIXMOREVODKA",
    		name: "鮮血轉換",
    		cardCode: "01NX047",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI024"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI010-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "召喚2個<link=card.summon><style=AssociatedCard>幽魂騎士</style></link>。",
    		descriptionRaw: "召喚2個幽魂騎士。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "彼時殂落此時生，牠們始終忠心如一。",
    		artistName: "Kudos Productions",
    		name: "暗影的逆襲",
    		cardCode: "01SI010",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX040T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX040.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX040-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "<link=keyword.AttackSkillMark><sprite name=AttackSkillMark><style=Keyword>攻擊</style></link>：對敵方主堡造成1點傷害。",
    		descriptionRaw: "攻擊：對敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「破盾兵可以把敵人砍成兩半。但倘若需要更加細膩的手段，軍團也不乏其他人才。」——傑利科．斯溫",
    		artistName: "SIXMOREVODKA",
    		name: "軍團破壞者",
    		cardCode: "01NX040",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI042",
    			"01SI042T2",
    			"01SI024"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI042T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI042T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 5,
    		cost: 6,
    		health: 6,
    		description: "使<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>友軍單位+3|+0。\r\n<link=vocab.Attack><style=Vocab>攻擊</style></link>：召喚2個攻擊中的<link=card.summon><style=AssociatedCard>幽魂騎士</style></link>。",
    		descriptionRaw: "使閃靈友軍單位+3|+0。\r\n攻擊：召喚2個攻擊中的幽魂騎士。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "仔細聽，他來了。重蹄踏了又踏，陳舊積鏽的盔甲摩擦作響，那戰士的鬼哭，那過去的回聲，和隨之而來迴盪的死寂。",
    		artistName: "SIXMOREVODKA",
    		name: "赫克林",
    		cardCode: "01SI042T1",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ032.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ032-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "大家都想捉到它。可憐的小傢伙，它只想在水坑裡玩耍啊！",
    		artistName: "SIXMOREVODKA",
    		name: "廢料河蟹",
    		cardCode: "01PZ032",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO009",
    			"01IO009T3",
    			"01IO009T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO009T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO009T2-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 3,
    		health: 3,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：召喚1個攻擊中的<link=card.summon><style=AssociatedCard>疾風殘影</style></link>，其能力值和特性與此牌相同。",
    		descriptionRaw: "攻擊：召喚1個攻擊中的疾風殘影，其能力值和特性與此牌相同。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「很少人回頭看自己的影子時會有所遲疑，那是他們此生做錯的最後一件事。」",
    		artistName: "SIXMOREVODKA",
    		name: "劫",
    		cardCode: "01IO009T2",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI027T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI027T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 6,
    		cost: 3,
    		health: 6,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「誰是你的神？祂有什麼神力？祂會命令你獻出生命捍衛祂的存在，還是會賜予你前所未有的生命與活力？若神不服侍你，你又何必服侍神？」——伊莉絲",
    		artistName: "SIXMOREVODKA",
    		name: "威洛魔",
    		cardCode: "01SI027T1",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "蜘蛛",
    		subtypes: [
    			"蜘蛛"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO014-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 3,
    		health: 1,
    		description: "召喚此牌時，賦予手牌中的所有友軍單位+1|+1。",
    		descriptionRaw: "召喚此牌時，賦予手牌中的所有友軍單位+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "愛歐尼亞的知識早已付諸文字，但真正賦予文字新生命的功臣，是愛歐尼亞受人尊崇、負責傳授傳奇與教誨的長老們。",
    		artistName: "SIXMOREVODKA",
    		name: "林地長老",
    		cardCode: "01IO014",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX038",
    			"01NX038T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX038T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX038T2-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 10,
    		cost: 6,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「膽敢阻路，我會親自把你砍成兩半！」",
    		artistName: "SIXMOREVODKA",
    		name: "達瑞斯",
    		cardCode: "01NX038T2",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE022",
    			"01DE022T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE022T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE022T2-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "進行<link=vocab.Rally><style=Vocab>備戰</style></link>。\r\n將1張<link=card.level1><style=AssociatedCard>路西恩</style></link>洗入我方牌組。",
    		descriptionRaw: "進行備戰。\r\n將1張路西恩洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: " 「每個人終要面對內心最深層的恐懼。算你幸運，因為我來了。」——路西恩",
    		artistName: "Max Grecke",
    		name: "路西恩 冷酷進擊",
    		cardCode: "01DE022T2",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ032"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ028.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ028-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "施放或被棄置時，召喚一個<link=card.summon><style=AssociatedCard>廢料河蟹</style></link>。",
    		descriptionRaw: "施放或被棄置時，召喚一個廢料河蟹。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "當時，年輕發明家手邊只剩一些廢料，時間所剩無幾，忽然她想起一個非比尋常的靈感來源：她曾在偏遠的叢林看過一隻生物沿著河岸小步快跑。",
    		artistName: "Kudos Productions",
    		name: "應急裝置",
    		cardCode: "01PZ028",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE025.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE025-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "使1個友軍單位<link=keyword.Capture><style=Keyword>俘虜</style></link>另一個單位。",
    		descriptionRaw: "使1個友軍單位俘虜另一個單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「服從我們吧。我們代表法律，而你必須遵守。不得有異議。」——獵魔宣教士",
    		artistName: "Rafael Zanchetin",
    		name: "束縛",
    		cardCode: "01DE025",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR036T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR036.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR036-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 3,
    		health: 1,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：對1個敵軍單位造成1點傷害。",
    		descriptionRaw: "出牌：對1個敵軍單位造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "在弗雷爾卓德不打獵，你就準備挨餓。",
    		artistName: "SIXMOREVODKA",
    		name: "艾伐洛森神射手",
    		cardCode: "01FR036",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO005-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我知道聽起來很不可思議，但我記得的最後一件事就是……毛茸茸的觸感……？」——那歐竊匪",
    		artistName: "SIXMOREVODKA",
    		name: "靈巧普羅",
    		cardCode: "01IO005",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "普羅",
    		subtypes: [
    			"普羅"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR045.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR045-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 2,
    		cost: 3,
    		health: 4,
    		description: "此牌承受傷害且未陣亡時，賦予此牌+3|+0。",
    		descriptionRaw: "此牌承受傷害且未陣亡時，賦予此牌+3|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「史瓦妮賜給我第一道戰痕時，我就對冬之爪立下誓言。從此之後，每道戰痕都是為她效勞所得的賞賜。」",
    		artistName: "SIXMOREVODKA",
    		name: "戰痕族長史特芬",
    		cardCode: "01FR045",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO044.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO044-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "<link=keyword.Recall><style=Keyword>召回</style></link>1個友軍單位即可出此牌。",
    		descriptionRaw: "召回1個友軍單位即可出此牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「快，我們得趕緊離開這裡！我叫什麼名字？我會在路上解釋清楚，我保證……」",
    		artistName: "SIXMOREVODKA",
    		name: "那歐土匪",
    		cardCode: "01IO044",
    		keywords: [
    			"隱密"
    		],
    		keywordRefs: [
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR008T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR008T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "召喚此牌時，在手牌隨機生成1張不分區域、魔耗值1的普羅牌。",
    		descriptionRaw: "召喚此牌時，在手牌隨機生成1張不分區域、魔耗值1的普羅牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「喔吼！看這陽光的小傢伙！好像可以把凜冬都融化成明媚春天。」——普羅牧人",
    		artistName: "SIXMOREVODKA",
    		name: "雀躍普羅",
    		cardCode: "01FR008T1",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "普羅",
    		subtypes: [
    			"普羅"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR055.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR055-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "若敵軍單位力量值為0，則造成4點傷害。否則，<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>該單位。",
    		descriptionRaw: "若敵軍單位力量值為0，則造成4點傷害。否則，凍傷該單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「凜冬橫越大地之時，她能讓強者變得卑微，弱者變得墮落。」——戰痕族長史特芬",
    		artistName: "Kudos Productions",
    		name: "碎裂",
    		cardCode: "01FR055",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR038T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR038T3-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>1個敵軍單位，接著<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>所有其它生命值3點或以下的敵軍單位。抽1張牌。",
    		descriptionRaw: "凍傷1個敵軍單位，接著凍傷所有其它生命值3點或以下的敵軍單位。抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「全世界的力量都在這一箭。」——艾希",
    		artistName: "SIXMOREVODKA",
    		name: "水晶箭",
    		cardCode: "01FR038T3",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX046T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX046.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX046-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>1個敵軍單位。",
    		descriptionRaw: "出牌：擊暈1個敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「噢，我完全被她迷住了！她那雙誘人長腿、令人酥軟的甜美嗓音，還有玫瑰色的雙瞳。她今晚竟然願意與我共進佳餚，實在太幸運了！」——倒楣的貴族",
    		artistName: "SIXMOREVODKA",
    		name: "蜘蛛哨兵",
    		cardCode: "01NX046",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "蜘蛛",
    		subtypes: [
    			"蜘蛛"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ050.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ050-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予1個友軍單位+4|+0與<link=keyword.Quick Strike><sprite name=QuickStrike><style=Keyword>快速攻擊</style></link>。",
    		descriptionRaw: "本回合給予1個友軍單位+4|+0與快速攻擊。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「開始發光之後，我就有點發癢。這很正常……對吧？」——伊澤瑞爾",
    		artistName: "Original Force",
    		name: "咒能高漲",
    		cardCode: "01PZ050",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T6.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T6-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 3,
    		health: 1,
    		description: "<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。",
    		descriptionRaw: "飛逝。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我好像把最新成品搞丟了，連帶樓中樓也消失了。真擔心那個機器人，不過陶瓷研究實驗室曾傳出尖叫聲，看來我還有希望！」——《漢默丁格的實驗室手札》第3冊",
    		artistName: "SIXMOREVODKA",
    		name: "Mk3：破地螺旋鑽",
    		cardCode: "01PZ056T6",
    		keywords: [
    			"隱密"
    		],
    		keywordRefs: [
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "科技",
    		subtypes: [
    			"科技"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO023.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO023-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 5,
    		health: 4,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：賦予手牌中1個友軍單位+3|+3。",
    		descriptionRaw: "出牌：賦予手牌中1個友軍單位+3|+3。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「每次有衝突發生，村民們總會向秋谷的遠古守護者祈求。凡能打動她心之人，皆能受到祝福，扭轉戰鬥局勢。」——《最初淨土傳說》",
    		artistName: "SIXMOREVODKA",
    		name: "寶石迅獅",
    		cardCode: "01IO023",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI048T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI048.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI048-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 1,
    		cost: 2,
    		health: 1,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：召喚1個<link=card.summon><style=AssociatedCard>出柙邪靈</style></link>。",
    		descriptionRaw: "遺願：召喚1個出柙邪靈。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "狂癲加上時間，史上極惡的組合。",
    		artistName: "SIXMOREVODKA",
    		name: "受詛咒的看守人",
    		cardCode: "01SI048",
    		keywords: [
    			"無法進行格檔",
    			"遺願"
    		],
    		keywordRefs: [
    			"CantBlock",
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ054T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ054T1-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對敵方主堡造成2點傷害。",
    		descriptionRaw: "對敵方主堡造成2點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「閃人！」——爆破幫菜鳥",
    		artistName: "Kudos Productions",
    		name: "暗中破壞",
    		cardCode: "01PZ054T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ030T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ030T1-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "選1個侍從單位，將此牌幻化為與之相同的複製單位。",
    		descriptionRaw: "選1個侍從單位，將此牌幻化為與之相同的複製單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "肯定不是兩個喬裝打扮的約德爾人。",
    		artistName: "Kudos Productions",
    		name: "維妙維肖",
    		cardCode: "01PZ030T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX025.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX025-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "賦予2個友軍單位+2|+0。",
    		descriptionRaw: "賦予2個友軍單位+2|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「戰場上結拜的兄弟姊妹與親人沒兩樣。畢竟，血濃於水。」——軍團老兵",
    		artistName: "Wild Blue Studios",
    		name: "同袍兄弟",
    		cardCode: "01NX025",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX055.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX055-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，召喚1個<link=card.summon><style=AssociatedCard>小蜘蛛</style></link>。",
    		descriptionRaw: "召喚此牌時，召喚1個小蜘蛛。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我的蜘蛛渴望有人陪伴，可惜牠們只是一廂情願。」——伊莉絲",
    		artistName: "Alex Heath",
    		name: "普通蜘蛛",
    		cardCode: "01NX055",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "蜘蛛",
    		subtypes: [
    			"蜘蛛"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE007-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "使1個戰鬥中友軍單位<link=vocab.Strike><style=Vocab>打擊</style></link>所有戰鬥中敵軍單位。",
    		descriptionRaw: "使1個戰鬥中友軍單位打擊所有戰鬥中敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "正義總會繞一圈回到原點。",
    		artistName: "Kudos Productions",
    		name: "審判",
    		cardCode: "01DE007",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ047"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ017-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "召喚此牌時，召喚2個<link=card.create><style=AssociatedCard>腐蝕藥劑桶</style></link>。",
    		descriptionRaw: "召喚此牌時，召喚2個腐蝕藥劑桶。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「齊爾派你來的？我跟他說過了，這跟我沒關係。我自己沒見過的商品要怎麼退費呢？不過既然事情都發生了，我手上倒是有一批新貨可以割愛……」",
    		artistName: "SIXMOREVODKA",
    		name: "藥劑桶供應商",
    		cardCode: "01PZ017",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ038.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ038-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 4,
    		cost: 2,
    		health: 3,
    		description: "棄置1張牌即可出此牌。",
    		descriptionRaw: "棄置1張牌即可出此牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "汙水坑是物盡其用的極致典範。",
    		artistName: "SIXMOREVODKA",
    		name: "汙水坑疏濬機器人",
    		cardCode: "01PZ038",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T7.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T7-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 2,
    		health: 1,
    		description: "<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。",
    		descriptionRaw: "飛逝。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「實驗室需要一些保全措施！最近傳出消息，小杰西的工作坊被小偷洗劫了一番。哈，想闖空門的盜匪注意啦！」——《漢默丁格的實驗室手札》第2冊",
    		artistName: "SIXMOREVODKA",
    		name: "Mk2：進化砲臺",
    		cardCode: "01PZ056T7",
    		keywords: [
    			"堅忍"
    		],
    		keywordRefs: [
    			"Tough"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "科技",
    		subtypes: [
    			"科技"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI018-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 3,
    		health: 3,
    		description: "召喚此牌時，在手牌生成1張本牌局陣亡友軍單位的複製牌。",
    		descriptionRaw: "召喚此牌時，在手牌生成1張本牌局陣亡友軍單位的複製牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「作者毫不知情，殞落王者的詛咒很快就要——就要——不、不、不，墨水怎麼又灑出來了！作者毫不知情——不、不、不！」",
    		artistName: "SIXMOREVODKA",
    		name: "憂傷抄寫員",
    		cardCode: "01SI018",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ008",
    			"01PZ008T2",
    			"01PZ022"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ008T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ008T1-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "將5張<link=card.shuffle><style=AssociatedCard>劇毒膨菇</style></link>隨機植入敵方牌組。\r\n將1張<link=card.level1><style=AssociatedCard>提摩</style></link>洗入我方牌組。",
    		descriptionRaw: "將5張劇毒膨菇隨機植入敵方牌組。\r\n將1張提摩洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "首先，你聽到膨菇爆開的輕輕一聲「砰」。接著，一股劇烈疼痛逐漸削弱你的力量。最後，只剩下遠處傳來的咯咯笑聲……",
    		artistName: "",
    		name: "提摩 蘑菇雲",
    		cardCode: "01PZ008T1",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI030",
    			"01SI030T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI030T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI030T2-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 5,
    		cost: 3,
    		health: 4,
    		description: "每回合此牌第一次攻擊時，復甦1個<link=vocab.Strongest><style=Vocab>最強</style></link>的已陣亡友軍侍從單位，使其處於攻擊中並賦予<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。該回合此牌與該單位締結關係，此牌所受傷害轉嫁至該單位。",
    		descriptionRaw: "每回合此牌第一次攻擊時，復甦1個最強的已陣亡友軍侍從單位，使其處於攻擊中並賦予閃靈。該回合此牌與該單位締結關係，此牌所受傷害轉嫁至該單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「被錯待的人應得報仇雪恨！」",
    		artistName: "SIXMOREVODKA",
    		name: "克黎思妲",
    		cardCode: "01SI030T2",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR029.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR029-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "抽1張英雄牌。",
    		descriptionRaw: "抽1張英雄牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「掠奪者來襲！吹響軍號、點燃狼煙，我們必須盡可能召集援軍全力抵禦！」——艾伐洛森哨兵",
    		artistName: "SIXMOREVODKA",
    		name: "吹號求援",
    		cardCode: "01FR029",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI035T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI035T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "若本回合有友軍單位陣亡，則擊殺2個<link=keyword.Weakest><style=Keyword>最弱</style></link>敵軍單位。",
    		descriptionRaw: "若本回合有友軍單位陣亡，則擊殺2個最弱敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "去蕪存菁。",
    		artistName: "Kudos Productions",
    		name: "子夜收割",
    		cardCode: "01SI035T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI030T2",
    			"01SI030T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI030.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI030-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 3,
    		health: 3,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "此牌在場上時，有3個或以上友軍單位陣亡<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌在場上時，有3個或以上友軍單位陣亡。",
    		flavorText: "她生前是一名將軍，守護王國的英雌。但隨著肉身消逝，她心中僅剩報復的熊熊怒火。她成了滿心只想報仇雪恨的不死怨靈。",
    		artistName: "SIXMOREVODKA",
    		name: "克黎思妲",
    		cardCode: "01SI030",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO029.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO029-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "賦予手牌中所有友軍單位+1|+0。",
    		descriptionRaw: "賦予手牌中所有友軍單位+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「這些不僅僅是種子、幼苗，也是大地本身的傳承，賜予我們豐盛未來的承諾。」——卡瑪",
    		artistName: "Wild Blue Studios",
    		name: "播撒的種子",
    		cardCode: "01IO029",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ052",
    			"01PZ036",
    			"01PZ036T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ036T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ036T1-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 3,
    		health: 4,
    		description: "<link=vocab.Nexus Strike><style=Vocab>打擊主堡</style></link>：在手牌生成1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.create><style=AssociatedCard>秘術射擊</style></link>。\r\n施放法術時，對敵方主堡造成2點傷害。",
    		descriptionRaw: "打擊主堡：在手牌生成1張飛逝秘術射擊。\r\n施放法術時，對敵方主堡造成2點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我的專長就是化不可能為可能！」",
    		artistName: "SIXMOREVODKA",
    		name: "伊澤瑞爾",
    		cardCode: "01PZ036T1",
    		keywords: [
    			"隱密",
    			"灌輸"
    		],
    		keywordRefs: [
    			"Elusive",
    			"Imbue"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR035.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR035-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 1,
    		health: 3,
    		description: "此牌承受傷害且未陣亡時，賦予此牌+3|+0。",
    		descriptionRaw: "此牌承受傷害且未陣亡時，賦予此牌+3|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「艾伐洛森人只會把孩子教成軟弱畏戰的個性。我們的孩子則在戰火中誕生。」——戰痕之母芙蕊娜\n",
    		artistName: "SIXMOREVODKA",
    		name: "無戰痕掠奪者",
    		cardCode: "01FR035",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO003-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "將1個友軍單位的<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>轉移至1個敵軍單位身上。",
    		descriptionRaw: "將1個友軍單位的閃靈轉移至1個敵軍單位身上。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我是隱身黑暗的利刃。」——劫\n\n",
    		artistName: "Kudos Productions",
    		name: "死亡印記",
    		cardCode: "01IO003",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ035.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ035-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 6,
    		cost: 8,
    		health: 6,
    		description: "此牌成為法術目標時，抽1張牌。",
    		descriptionRaw: "此牌成為法術目標時，抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "梅德拉達氏族在皮爾托福聲名顯赫，身為法定繼承人的杰卻對家族事業興趣缺缺，成天只想追尋古文物……父親為此苦惱不已。",
    		artistName: "SIXMOREVODKA",
    		name: "杰．梅德拉達",
    		cardCode: "01PZ035",
    		keywords: [
    			"隱密"
    		],
    		keywordRefs: [
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ030T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ030.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ030-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 4,
    		health: 3,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：選1個侍從單位，將此牌幻化為與之相同的複製單位。",
    		descriptionRaw: "出牌：選1個侍從單位，將此牌幻化為與之相同的複製單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「各位化學伯爵，大家好！」",
    		artistName: "SIXMOREVODKA",
    		name: "可疑人物",
    		cardCode: "01PZ030",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO047.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO047-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "賦予所有戰鬥中侍從單位<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。",
    		descriptionRaw: "賦予所有戰鬥中侍從單位閃靈。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "當魔法的流動失去平衡，便會從精神世界湧入物質領域，後果往往不堪設想。",
    		artistName: "Kudos Productions",
    		name: "暗影火光",
    		cardCode: "01IO047",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ048T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ048.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ048-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 6,
    		cost: 9,
    		health: 6,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>泯滅</style></link>我方牌組前5張牌，其中每張法術可對所有敵軍造成1傷害。",
    		descriptionRaw: "出牌：泯滅我方牌組前5張牌，其中每張法術可對所有敵軍造成1傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「目光如豆的皮爾托福人只搞齒輪、金屬那套，不懂我培育的那些根莖、花瓣和細胞是多麼細緻的藝術。我會為他們打造優雅無比的死亡體驗，優雅到他們根本配不上。」",
    		artistName: "SIXMOREVODKA",
    		name: "可瑞娜．瓦拉撒",
    		cardCode: "01PZ048",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR012-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "獲得1個魔力寶石槽位並治癒主堡3點。",
    		descriptionRaw: "獲得1個魔力寶石槽位並治癒主堡3點。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "魔方之石是一塊具有神奇恢復能力的超凡寶石，無論紅水晶或藍水晶都無法比擬其散發出的光澤。 ",
    		artistName: "Kudos Production",
    		name: "催化魔方",
    		cardCode: "01FR012",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX020",
    			"01NX020T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX020T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX020T2-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "使1名戰鬥中友軍單位<link=vocab.Strike><style=Vocab>打擊</style></link>1名戰鬥中敵軍單位。\r\n將1張<link=card.level1><style=AssociatedCard>達瑞文</style></link>洗入我方牌組。",
    		descriptionRaw: "使1名戰鬥中友軍單位打擊1名戰鬥中敵軍單位。\r\n將1張達瑞文洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我最愛這份工作了！」——達瑞文",
    		artistName: "Rafael Zanchetin",
    		name: "達瑞文 迴轉死神",
    		cardCode: "01NX020T2",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX030.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX030-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "此牌承受傷害且未陣亡時，對敵方主堡造成2點傷害。",
    		descriptionRaw: "此牌承受傷害且未陣亡時，對敵方主堡造成2點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「好想你啊，愛德文！你收到邀請了嗎？」「規定上是沒有特別區分新人和老鳥啦。我只希望那天別下雨。」「老父老母要是知道實情，肯定會把我趕出家門。」「血氣方剛的小毛頭才會幹這種事。」",
    		artistName: "SIXMOREVODKA",
    		name: "血色門徒",
    		cardCode: "01NX030",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR028.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR028-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 5,
    		cost: 1,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "雪怪？這東西根本不存——「哇啊啊啊啊！」",
    		artistName: "SIXMOREVODKA",
    		name: "暴怒雪怪",
    		cardCode: "01FR028",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "雪怪",
    		subtypes: [
    			"雪怪"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ022"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ010-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "將5張<link=card.shuffle><style=AssociatedCard>劇毒膨菇</style></link>隨機植入敵方牌組。",
    		descriptionRaw: "將5張劇毒膨菇隨機植入敵方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "首先，你聽到膨菇爆開的輕輕一聲「砰」。接著，一股劇烈疼痛逐漸削弱你的力量。最後，只剩下遠處傳來的咯咯笑聲……",
    		artistName: "Kudos Productions",
    		name: "蘑菇雲",
    		cardCode: "01PZ010",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX007-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：本回合給予其他戰鬥中友軍單位+1|+0。",
    		descriptionRaw: "攻擊：本回合給予其他戰鬥中友軍單位+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "他歡欣高吼。在那瞬間，整座競技場的心跳與他的脈搏合為一體，觀眾的激動興奮之情全緊握在他勝利的手中。",
    		artistName: "SIXMOREVODKA",
    		name: "競技場主持人",
    		cardCode: "01NX007",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ045.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ045-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "棄置1張牌即可出此牌。\r\n<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：抽1張牌。",
    		descriptionRaw: "棄置1張牌即可出此牌。\r\n遺願：抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「還以為汙水坑的貧民們多少會互相照顧呢。」\n「兄弟，他們光自怨自艾就沒時間了吧。」\n「真可憐。呃……你有看到我的錢包嗎？」",
    		artistName: "SIXMOREVODKA",
    		name: "佐恩小乞丐",
    		cardCode: "01PZ045",
    		keywords: [
    			"遺願"
    		],
    		keywordRefs: [
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO026.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO026-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 1,
    		health: 2,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：賦予手牌中1個友軍單位+1|+0。",
    		descriptionRaw: "出牌：賦予手牌中1個友軍單位+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我花費數年才養成這般足以致命的體格！那些賞鳥、觀雲，以及抬起一盤又一盤甜麵包的辛苦日子！誰能有這般毅力呢？」",
    		artistName: "SIXMOREVODKA",
    		name: "精神導師",
    		cardCode: "01IO026",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ013T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ013T1-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "棄置所有手牌後抽3張牌，並對1個敵軍單位造成3點傷害。",
    		descriptionRaw: "棄置所有手牌後抽3張牌，並對1個敵軍單位造成3點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "追求進步，不計代價。",
    		artistName: "Rafael Zanchetin",
    		name: "貿然研究",
    		cardCode: "01PZ013T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ002-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 4,
    		health: 2,
    		description: "召喚此牌時，本牌局我方每召喚1個<link=card.me><style=AssociatedCard>陋巷酒吧老闆</style></link>，則在手牌隨機生成1張牌。<style=Variable></style>",
    		descriptionRaw: "召喚此牌時，本牌局我方每召喚1個陋巷酒吧老闆，則在手牌隨機生成1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「沒錯，夥計。它有一種淡淡的風味，就像汙水坑總是飄著一股淡淡的味道。酒桶就在吟唱歌手旁邊。」",
    		artistName: "SIXMOREVODKA",
    		name: "陋巷酒吧老闆",
    		cardCode: "01PZ002",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI002-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「有什麼好怕的？不過就是一隻小蜘蛛。」——倒楣的貴族，薩森領主",
    		artistName: "SIXMOREVODKA",
    		name: "小蜘蛛",
    		cardCode: "01SI002",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "蜘蛛",
    		subtypes: [
    			"蜘蛛"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI005-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 5,
    		cost: 10,
    		health: 5,
    		description: "本牌局每有1個友軍單位陣亡，則此牌魔耗值-1。",
    		descriptionRaw: "本牌局每有1個友軍單位陣亡，則此牌魔耗值-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "某個早已被忘卻的王國曾把這隻怪獸當作駝獸，現在牠穿梭在各個廢棄戰地拾荒，沿路將廢料放入殼內，將死者亡魂吞入腹中。",
    		artistName: "SIXMOREVODKA",
    		name: "鑿魂怪",
    		cardCode: "01SI005",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR038T2",
    			"01FR038T1",
    			"01FR038T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR038.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR038-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 5,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link><link=vocab.Strongest><style=Vocab>最強</style></link>的敵軍。",
    		descriptionRaw: "攻擊：凍傷最強的敵軍。",
    		levelupDescription: "我方<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>5個或以上的敵軍單位<style=Variable></style>。此牌升級時，在牌組最上方生成1張<link=card.create><style=AssociatedCard>水晶箭</style></link>。",
    		levelupDescriptionRaw: "我方凍傷5個或以上的敵軍單位。此牌升級時，在牌組最上方生成1張水晶箭。",
    		flavorText: "「當我瞭望家園，看到的不僅是現在，也看到可能的未來：一片昌盛的榮景，不只是我的族人得享富足，也包括所有企求和平的人。弗雷爾卓德，萬眾而一心！」",
    		artistName: "SIXMOREVODKA",
    		name: "艾希",
    		cardCode: "01FR038",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE055.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE055-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 3,
    		health: 2,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：本回合給予1個友軍單位<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。",
    		descriptionRaw: "出牌：本回合給予1個友軍單位挑戰者。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「他看上去就是位打扮花俏，手持昂貴寶劍的紈絝子弟。萬萬沒想到，他真的知道怎麼揮劍！我想再跟他比劃一場，不過他操著誇張的口音，我沒聽清楚他的名字。」——蒂瑪西亞少尉",
    		artistName: "JiHun Lee",
    		name: "羅倫特家族決鬥家",
    		cardCode: "01DE055",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ004-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "從敵軍單位與主堡中任選3個目標，依序造成3點、2點、1點傷害。",
    		descriptionRaw: "從敵軍單位與主堡中任選3個目標，依序造成3點、2點、1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「天才不需要運氣，照樣百發百中。」——伊澤瑞爾",
    		artistName: "Max Grecke",
    		name: "精準彈幕",
    		cardCode: "01PZ004",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE048.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE048-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 4,
    		health: 3,
    		description: "若我方在本牌局已施放1張魔耗值6點或以上的法術牌，則賦予此牌+2|+2。",
    		descriptionRaw: "若我方在本牌局已施放1張魔耗值6點或以上的法術牌，則賦予此牌+2|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「很久以前，因符文聖戰引發的狂暴魔法，將整片符文大地摧殘得狼狽不堪。本組織之所以建立，正是為了驅逐王國內外的所有魔法，保護全體人民。」——獵魔者手冊",
    		artistName: "SIXMOREVODKA",
    		name: "獵魔煽動者",
    		cardCode: "01DE048",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO024.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO024-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "選擇1個友軍單位，召喚2個與之相同的複製單位，其皆為<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。",
    		descriptionRaw: "選擇1個友軍單位，召喚2個與之相同的複製單位，其皆為閃靈。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「慎在兩個世界之間進退兩難，他最終只會把兩邊都搞砸。我只把自己全心奉獻給愛歐尼亞。」——劫",
    		artistName: "Kudos Productions",
    		name: "黎明與黃昏",
    		cardCode: "01IO024",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI053T1",
    			"01SI053"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI053T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI053T2-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 2,
    		health: 3,
    		description: "使我方其他蜘蛛單位擁有<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>和<link=keyword.Fearsome><sprite name=Fearsome><style=Keyword>威嚇</style></link>。",
    		descriptionRaw: "使我方其他蜘蛛單位擁有挑戰者和威嚇。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "情人眼裡出蜘蛛。",
    		artistName: "SIXMOREVODKA",
    		name: "蜘蛛女王伊莉絲",
    		cardCode: "01SI053T2",
    		keywords: [
    			"威嚇",
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Fearsome",
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "蜘蛛",
    		subtypes: [
    			"蜘蛛"
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE001-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Allegiance><style=Vocab>效忠</style></link>：賦予其他友軍單位+1|+1。",
    		descriptionRaw: "效忠：賦予其他友軍單位+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你們必須了解我國旗幟所承載的重負。旗幟為了我們的國王、家園，還有人民而飛揚。這是我們對蒂瑪西亞堅定不移的信念。將旗幟高舉，向他們展現我們的驕傲。」——塔蒂雅娜．皇冠守衛 ",
    		artistName: "SIXMOREVODKA",
    		name: "先鋒掌旗手",
    		cardCode: "01DE001",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "菁英",
    		subtypes: [
    			"菁英"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ020-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "第一次發射純粹是個意外，她在理毛的時候不小心滑入進步日禮炮。現在，她成了皮爾托福的大明星，成天劃過高空，飛越底下發出讚嘆聲的人群。",
    		artistName: "SIXMOREVODKA",
    		name: "大膽普羅",
    		cardCode: "01PZ020",
    		keywords: [
    			"隱密"
    		],
    		keywordRefs: [
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "普羅",
    		subtypes: [
    			"普羅"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX021.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX021-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：賦予我方<link=vocab.Everywhere><style=Vocab>各處</style></link>的軍團掠奪者+1|+1。",
    		descriptionRaw: "攻擊：賦予我方各處的軍團掠奪者+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "特菲利安軍團身後總是跟著一群投機的賊寇，隨時伺機上前掠奪戰後倖存的老弱傷殘。",
    		artistName: "SIXMOREVODKA",
    		name: "軍團流寇",
    		cardCode: "01NX021",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR020-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "對所有單位造成2點傷害。",
    		descriptionRaw: "對所有單位造成2點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "每次雪崩皆肇因自一顆不安分的礫石。",
    		artistName: "SIXMOREVODKA",
    		name: "雪崩",
    		cardCode: "01FR020",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ046.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ046-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "選1張手牌，生成4張與之相同的複製牌並洗入我方牌組。",
    		descriptionRaw: "選1張手牌，生成4張與之相同的複製牌並洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "最真摯的盜竊叫作模仿。",
    		artistName: "Kudos Productions",
    		name: "盜版贗品",
    		cardCode: "01PZ046",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO028.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO028-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 3,
    		health: 2,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：賦予此牌+3|+0或+0|+3。",
    		descriptionRaw: "出牌：賦予此牌+3|+0或+0|+3。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "林地最年邁的生物之一，它的適應力歷久不衰，證明自己經得起時間的考驗。",
    		artistName: "SIXMOREVODKA",
    		name: "鱗甲四不像",
    		cardCode: "01IO028",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR028"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR014-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 1,
    		cost: 1,
    		health: 2,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：將2張<link=card.create><style=AssociatedCard>暴怒雪怪</style></link>洗入我方牌組。",
    		descriptionRaw: "遺願：將2張暴怒雪怪洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「它小小一隻又那麼與世無爭！真難相信長大後就變成……呃……一隻大雪怪。」——艾伐洛森捕獸人",
    		artistName: "SIXMOREVODKA",
    		name: "幼年雪怪",
    		cardCode: "01FR014",
    		keywords: [
    			"遺願"
    		],
    		keywordRefs: [
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "雪怪",
    		subtypes: [
    			"雪怪"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI037.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI037-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "說真的，死在普羅手下其實不算太差。",
    		artistName: "SIXMOREVODKA",
    		name: "凶厄普羅",
    		cardCode: "01SI037",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "普羅",
    		subtypes: [
    			"普羅"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX009-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 4,
    		health: 1,
    		description: "召喚此牌時，我方場上每有1個友軍單位，則賦予此牌+1|+1。",
    		descriptionRaw: "召喚此牌時，我方場上每有1個友軍單位，則賦予此牌+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "有些角鬥士散發服人的魅力，有些角鬥士則是身手矯捷。維錫德既不迷人，也不敏捷，但沒人能比他更快把對手打成肉醬。",
    		artistName: "SIXMOREVODKA",
    		name: "人氣角鬥士",
    		cardCode: "01NX009",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO057.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO057-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 3,
    		health: 2,
    		description: "召喚此牌時，抽1張牌。",
    		descriptionRaw: "召喚此牌時，抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "她優雅踩著\n無聲的步伐踏入暗影；\n爪痕是唯一留下的行跡。",
    		artistName: "JiHun Lee",
    		name: "暗影刺客",
    		cardCode: "01IO057",
    		keywords: [
    			"隱密"
    		],
    		keywordRefs: [
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO028T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO028T2-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 5,
    		cost: 3,
    		health: 2,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "林地最年邁的生物之一，它的適應力歷久不衰，證明自己經得起時間的考驗。",
    		artistName: "SIXMOREVODKA",
    		name: "鱗甲四不像",
    		cardCode: "01IO028T2",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ054T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ054.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ054-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 2,
    		health: 4,
    		description: "<link=keyword.AttackSkillMark><sprite name=AttackSkillMark><style=Keyword>攻擊</style></link>：對敵方主堡造成2點傷害。",
    		descriptionRaw: "攻擊：對敵方主堡造成2點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你這樣做對嗎？」\n「不確定。」\n「你應該要確定的啊。」\n「你應該一開始就別問。」",
    		artistName: "SIXMOREVODKA",
    		name: "爆破幫菜鳥",
    		cardCode: "01PZ054",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX020T1",
    			"01NX020T3",
    			"01NX020T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX020-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>或<link=vocab.Strike><style=Vocab>打擊</style></link>：在手牌生成1張<link=card.create><style=AssociatedCard>迴旋飛斧</style></link>。",
    		descriptionRaw: "出牌或打擊：在手牌生成1張迴旋飛斧。",
    		levelupDescription: "此牌同時獲得兩張<link=card.create><style=AssociatedCard>迴旋飛斧</style></link>的效果後進行<link=vocab.Strike><style=Vocab>打擊</style></link>。<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌同時獲得兩張迴旋飛斧的效果後進行打擊。。",
    		flavorText: "「想要親筆簽名？去排隊吧，老兄。」",
    		artistName: "SIXMOREVODKA",
    		name: "達瑞文",
    		cardCode: "01NX020",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ052.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ052-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "對任一目標造成2點傷害。",
    		descriptionRaw: "對任一目標造成2點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我從不失手。但大家都知道我會先射兩發，以示警戒……」——伊澤瑞爾",
    		artistName: "Max Grecke",
    		name: "秘術射擊",
    		cardCode: "01PZ052",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR024",
    			"01FR024T3",
    			"01FR024T4"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR024T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR024T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>2個敵軍單位。\r\n將1張<link=card.level1><style=AssociatedCard>艾妮維亞</style></link>洗入我方牌組。",
    		descriptionRaw: "凍傷2個敵軍單位。\r\n將1張艾妮維亞洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你竟敢在我的地盤挑戰我？小子，你根本是來送死。」——艾妮維亞",
    		artistName: "Kudos Productions",
    		name: "艾妮維亞 嚴寒狂風",
    		cardCode: "01FR024T1",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE043.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE043-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：本回合給予此牌支援的友軍單位+1|+1。",
    		descriptionRaw: "支援：本回合給予此牌支援的友軍單位+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "別輕視蒂瑪西亞軍隊裡的任何一名成員。",
    		artistName: "SIXMOREVODKA",
    		name: "戰地廚師",
    		cardCode: "01DE043",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ052",
    			"01PZ036T1",
    			"01PZ036T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ036.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ036-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 3,
    		health: 3,
    		description: "<link=vocab.Nexus Strike><style=Vocab>打擊主堡</style></link>：在手牌生成1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.create><style=AssociatedCard>秘術射擊</style></link>。",
    		descriptionRaw: "打擊主堡：在手牌生成1張飛逝秘術射擊。",
    		levelupDescription: "我方將敵軍單位當成法術目標8次或以上<style=Variable></style>。",
    		levelupDescriptionRaw: "我方將敵軍單位當成法術目標8次或以上。",
    		flavorText: "「護目鏡？有了。圍巾？有了。我完全搞得懂運作原理的魔法臂鎧？有了，有了，都有了！」",
    		artistName: "SIXMOREVODKA",
    		name: "伊澤瑞爾",
    		cardCode: "01PZ036",
    		keywords: [
    			"隱密"
    		],
    		keywordRefs: [
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO028T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO028T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 3,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "林地最年邁的生物之一，它的適應力歷久不衰，證明自己經得起時間的考驗。",
    		artistName: "SIXMOREVODKA",
    		name: "鱗甲四不像",
    		cardCode: "01IO028T1",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI048T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI048T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 2,
    		health: 4,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "時間或許止住，狂癲卻仍永存。 ",
    		artistName: "SIXMOREVODKA",
    		name: "出柙邪靈",
    		cardCode: "01SI048T1",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ015.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ015-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 8,
    		cost: 8,
    		health: 8,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「終於完成了！六百五十二呎高，配備轉缸式發動機、海克斯鍍層、四鈾電池驅動的大腳巨獸！！！請容我自誇一下，這是我窮盡畢生之力的顛峰之作！」——《漢默丁格的實驗室手札第8冊》",
    		artistName: "SIXMOREVODKA",
    		name: "機械暴龍",
    		cardCode: "01PZ015",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "科技",
    		subtypes: [
    			"科技"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX053.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX053-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "若我方場上有1個力量值5點或以上的友軍單位，則擊殺所有力量值4以下的單位。",
    		descriptionRaw: "若我方場上有1個力量值5點或以上的友軍單位，則擊殺所有力量值4以下的單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「誰準備好上場廝殺啦？！！！」——競技場",
    		artistName: "Kudos Productions",
    		name: "決鬥",
    		cardCode: "01NX053",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ005-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "將1個侍從單位幻化為另一個侍從單位。",
    		descriptionRaw: "將1個侍從單位幻化為另一個侍從單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「是你一直嚷嚷著想變瘦啊。」\n「所以你就把我變成約德爾人？！」\n「你變瘦了啊！」\n「……我也變成約德爾人了！」",
    		artistName: "Kudos Productions",
    		name: "海克斯變形儀",
    		cardCode: "01PZ005",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX038",
    			"01NX038T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX038T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX038T1-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "對敵方主堡造成4點傷害。\r\n將1張<link=card.level1><style=AssociatedCard>達瑞斯</style></link>洗入我方牌組。",
    		descriptionRaw: "對敵方主堡造成4點傷害。\r\n將1張達瑞斯洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「攻城這檔事，有時候必須仰賴天才軍師，有時候只要更猛烈攻擊就行了。」——達瑞斯",
    		artistName: "Max Grecke",
    		name: "達瑞斯 毀滅風暴",
    		cardCode: "01NX038T1",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI052T1",
    			"01SI052T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI052.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI052-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 3,
    		cost: 5,
    		health: 6,
    		description: "1個敵軍單位陣亡時，治癒此牌1點生命。",
    		descriptionRaw: "1個敵軍單位陣亡時，治癒此牌1點生命。",
    		levelupDescription: "此牌在場上時，有6個或以上單位陣亡<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌在場上時，有6個或以上單位陣亡。",
    		flavorText: "鎖鏈鏗鏘作響，有人要來把你抓走……\n鎖鏈鏗鏘作響，獄長就在你身後……",
    		artistName: "SIXMOREVODKA",
    		name: "瑟雷西",
    		cardCode: "01SI052",
    		keywords: [
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE022",
    			"01DE022T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE022T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE022T1-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 2,
    		health: 3,
    		description: "每回合首次有友軍單位陣亡時，進行<link=vocab.Rally><style=Vocab>備戰</style></link>。",
    		descriptionRaw: "每回合首次有友軍單位陣亡時，進行備戰。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「世界上處處是怪物。看得到牠們的實體已經算走運了，潛伏在內心深處的無形怪物才最駭人。」",
    		artistName: "SIXMOREVODKA",
    		name: "路西恩",
    		cardCode: "01DE022T1",
    		keywords: [
    			"雙重攻擊"
    		],
    		keywordRefs: [
    			"DoubleStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE049.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE049-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「這名新兵的身上似乎散發出優良士兵特有的耐力與勇氣。有朝一日，他能加入無畏先鋒嗎？不過……他個子比一般人矮小，再看看他表現如何吧。」——先鋒中士",
    		artistName: "SIXMOREVODKA",
    		name: "英勇普羅",
    		cardCode: "01DE049",
    		keywords: [
    			"堅忍"
    		],
    		keywordRefs: [
    			"Tough"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "普羅",
    		subtypes: [
    			"普羅"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE012",
    			"01DE012T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE012T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE012T2-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "使1個戰鬥中友軍單位<link=vocab.Strike><style=Vocab>打擊</style></link>所有戰鬥中敵軍單位。\r\n將1張<link=card.level1><style=AssociatedCard>蓋倫</style></link>洗入我方牌組。",
    		descriptionRaw: "使1個戰鬥中友軍單位打擊所有戰鬥中敵軍單位。\r\n將1張蓋倫洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "正義總會繞一圈回到原點。",
    		artistName: "Kudos Productions",
    		name: "蓋倫 審判",
    		cardCode: "01DE012T2",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI033T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI033.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI033-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 9,
    		cost: 9,
    		health: 6,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：將敵方主堡生命值砍半，無條件捨去。\r\n<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：將此牌收回手牌。",
    		descriptionRaw: "出牌：將敵方主堡生命值砍半，無條件捨去。\r\n遺願：將此牌收回手牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "大多靈魂的記憶在年歲中逐漸消失殆盡，遺失了自我。但是萬分痛苦的雷卓思仍緊緊抓住過往不放。有些事情，連時間也無法沖淡。",
    		artistName: "SIXMOREVODKA",
    		name: "雷卓思指揮官",
    		cardCode: "01SI033",
    		keywords: [
    			"威嚇",
    			"遺願"
    		],
    		keywordRefs: [
    			"Fearsome",
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ021.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ021-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 5,
    		cost: 5,
    		health: 3,
    		description: "<link=vocab.Nexus Strike><style=Vocab>打擊主堡</style></link>：召喚1個與此牌相同的複製單位。",
    		descriptionRaw: "打擊主堡：召喚1個與此牌相同的複製單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「伯茲先生，我們發現你睡在金庫裡面，全身覆蓋著金色齒輪，一手還緊緊抓住金庫被砸壞的門。」\n「那不是我。只是某個長得跟我很像的傢伙。」\n「你到現在還抓著門不放呢。」\n「對啊，肯定不是我。」",
    		artistName: "SIXMOREVODKA",
    		name: "密登史多的黨羽",
    		cardCode: "01PZ021",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI003-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 10,
    		health: 0,
    		description: "復甦本牌局<link=vocab.Strongest><style=Vocab>最強的</style></link>6個陣亡友軍單位，賦予其<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。",
    		descriptionRaw: "復甦本牌局最強的6個陣亡友軍單位，賦予其閃靈。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "有幾天夜裡，一群飢餓的怨靈會乘著黯霧，穿越汪洋狩獵生者的靈魂，以新的邪惡不死生物餵養逐漸壯大的黑暗面。",
    		artistName: "Rafael Zanchetin",
    		name: "哈洛威",
    		cardCode: "01SI003",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI041.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI041-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 3,
    		health: 2,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：下次<link=vocab.RoundStart><style=Vocab>回合開始</style></link>時復甦此牌，且此牌每次陣亡，賦予其+1|+1。<style=Variable></style>",
    		descriptionRaw: "遺願：下次回合開始時復甦此牌，且此牌每次陣亡，賦予其+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "老烈士只記得自己召集了同袍，把他們全派去戰場上送死。但他已經很多年記不起原因了……",
    		artistName: "SIXMOREVODKA",
    		name: "不死戰魂",
    		cardCode: "01SI041",
    		keywords: [
    			"無法進行格檔",
    			"遺願"
    		],
    		keywordRefs: [
    			"CantBlock",
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX040T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX040T1-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對敵方主堡造成1點傷害。",
    		descriptionRaw: "對敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「砰。」——軍團破壞者",
    		artistName: "Kudos Productions",
    		name: "蓄意破壞",
    		cardCode: "01NX040T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR049T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR049.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR049-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，為敵方召喚1個<link=card.summon><style=AssociatedCard>雪兔</style></link>。",
    		descriptionRaw: "召喚此牌時，為敵方召喚1個雪兔。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「兔子就是兔子，永遠無法變成狼。」——冬之爪俗語",
    		artistName: "SIXMOREVODKA",
    		name: "潛行狼",
    		cardCode: "01FR049",
    		keywords: [
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO032T2",
    			"01IO032"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO032T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO032T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 4,
    		health: 6,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：給予此牌支援的友軍單位<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。\r\n有友軍單位獲得<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>時，本回合給予該單位+3|+0。",
    		descriptionRaw: "支援：給予此牌支援的友軍單位光盾。\r\n有友軍單位獲得光盾時，本回合給予該單位+3|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「...雙方的行動和諧存在，在我的看守下，他們互不侵犯。」",
    		artistName: "SIXMOREVODKA",
    		name: "慎",
    		cardCode: "01IO032T1",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE053.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE053-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 4,
    		health: 1,
    		description: "<link=vocab.Strike><style=Vocab>打擊</style></link>：在手牌隨機生成1張<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>侍從牌。",
    		descriptionRaw: "打擊：在手牌隨機生成1張挑戰者侍從牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「……我的天啊。」——菲歐拉",
    		artistName: "SIXMOREVODKA",
    		name: "羅倫特家族騎士",
    		cardCode: "01DE053",
    		keywords: [
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI045.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI045-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "從1名友軍單位<link=keyword.Drain><style=Keyword>汲取</style></link>4點生命值。",
    		descriptionRaw: "從1名友軍單位汲取4點生命值。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你的衰亡，造就我的強大。」——瑟雷西",
    		artistName: "Kudos Productions",
    		name: "魂靈吸噬",
    		cardCode: "01SI045",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR037.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR037-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Allegiance><style=Vocab>效忠</style></link>：賦予牌組最上方的友軍單位+3|+3與<link=keyword.Overwhelm><sprite name=Overwhelm><style=Keyword>勢不可擋</style></link>。",
    		descriptionRaw: "效忠：賦予牌組最上方的友軍單位+3|+3與勢不可擋。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "增援部隊在山脊上列陣，騎衛隊低頭向戰爭之母行禮。因為他們的艾希女王，艾伐洛森的化身，將為子民帶來和平。",
    		artistName: "SIXMOREVODKA",
    		name: "艾伐洛森騎衛隊",
    		cardCode: "01FR037",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI036.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI036-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "若本回合有友軍單位陣亡，則召喚2個<link=card.create><style=AssociatedCard>小蜘蛛</style></link>。",
    		descriptionRaw: "若本回合有友軍單位陣亡，則召喚2個小蜘蛛。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "嚇到起雞皮疙瘩很可怕？你還沒嘗過打從心底感到毛骨悚然的滋味。",
    		artistName: "Kudos Productions",
    		name: "寒毛直豎",
    		cardCode: "01SI036",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR053",
    			"01FR009T2",
    			"01FR009"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR009T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR009T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 3,
    		health: 7,
    		description: "此牌承受傷害且未陣亡時，召喚1個<link=card.create><style=AssociatedCard>大力普羅</style></link>。",
    		descriptionRaw: "此牌承受傷害且未陣亡時，召喚1個大力普羅。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「聽好了，我要告訴你布郎姆與最強大普羅的故事！」\n——長者英格瓦",
    		artistName: "SIXMOREVODKA",
    		name: "布郎姆",
    		cardCode: "01FR009T1",
    		keywords: [
    			"挑戰者",
    			"再生"
    		],
    		keywordRefs: [
    			"Challenger",
    			"Regeneration"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO013.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO013-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 1,
    		health: 3,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「為了獲得力量，你願意犧牲什麼？這趟旅程從烙下誓言開始，直到你所能給的全被取走，才會抵達終點。」——劫",
    		artistName: "SIXMOREVODKA",
    		name: "暗影之魔",
    		cardCode: "01IO013",
    		keywords: [
    			"閃靈"
    		],
    		keywordRefs: [
    			"Ephemeral"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ031.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ031-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "從敵方單位與主堡中任選2個目標，各造成1點傷害。\r\n抽1張牌。",
    		descriptionRaw: "從敵方單位與主堡中任選2個目標，各造成1點傷害。\r\n抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「這就是我們發現弧放電的方式！沒錯，這個假設是我的前輩提出的，但他卻低估了電弧的廣泛應用。真是愚鈍的傢伙……」——漢默丁格",
    		artistName: "Kudos Production",
    		name: "史提克衝擊",
    		cardCode: "01PZ031",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI024.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI024-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "擺脫肉身的束縛後，受到詛咒的騎士與野獸合為一體，只顧埋頭衝進他們再也無法理解的戰鬥。",
    		artistName: "SIXMOREVODKA",
    		name: "幽魂騎士",
    		cardCode: "01SI024",
    		keywords: [
    			"閃靈"
    		],
    		keywordRefs: [
    			"Ephemeral"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI051.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI051-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 5,
    		health: 4,
    		description: "1個友軍單位陣亡時，恢復我方的法術魔力。",
    		descriptionRaw: "1個友軍單位陣亡時，恢復我方的法術魔力。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "他焚膏繼晷，想將作品修到完美境界。不料，瞬間一陣黑煙靜靜穿過他的身體。周遭的人尖叫著逃命，他卻絲毫沒發現不對勁。",
    		artistName: "SIXMOREVODKA",
    		name: "飽受折磨的奇才",
    		cardCode: "01SI051",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR026.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR026-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 7,
    		cost: 6,
    		health: 6,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "集戰馬的力量及貓科動物的野蠻於一身。",
    		artistName: "SIXMOREVODKA",
    		name: "狂爪狼王",
    		cardCode: "01FR026",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX054.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX054-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>所有力量值4以下的敵軍單位。",
    		descriptionRaw: "擊暈所有力量值4以下的敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「他深深地吸一口氣，我們即將看到——沒錯，觀眾們！那就是雷電最有名的戰嚎！我們當場都嚇到腿軟了，閃～～電！」——競技場主持人",
    		artistName: "Kudos Productions",
    		name: "威嚇怒吼",
    		cardCode: "01NX054",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX006"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX006T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX006T2-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "除了<link=card.vlad><style=AssociatedCard>弗拉迪米爾</style></link>，對每個攻擊中友軍單位造成1點傷害，且每傷害1個攻擊中友軍單位，便對敵方主堡造成1點傷害。",
    		descriptionRaw: "除了弗拉迪米爾，對每個攻擊中友軍單位造成1點傷害，且每傷害1個攻擊中友軍單位，便對敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「十足美味。」——弗拉迪米爾",
    		artistName: "Max Grecke",
    		name: "血色契約",
    		cardCode: "01NX006T2",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ059.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ059-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 3,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "擊殺、踩扁、摧毀，再來一次。",
    		artistName: "Dao Le",
    		name: "金嚇破壞機器人",
    		cardCode: "01PZ059",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX029.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX029-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 4,
    		cost: 4,
    		health: 5,
    		description: "每當其它友軍單位承受傷害且未陣亡時，賦予該單位+1|+0。",
    		descriptionRaw: "每當其它友軍單位承受傷害且未陣亡時，賦予該單位+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "他拖著瀕死的身軀離開戰場，在丈夫和藥師的悉心照料下逐漸復原。即使早已褪下戰袍多年，諾克薩斯仍不計成本留住這位見多識廣的沙場老將。",
    		artistName: "SIXMOREVODKA",
    		name: "軍團退將",
    		cardCode: "01NX029",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR030.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR030-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>1個生命值3點或以下的敵軍單位。",
    		descriptionRaw: "凍傷1個生命值3點或以下的敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「很冷嗎？哈！希望你的精神要比盛夏打造的鋼鐵更加堅韌！」——布郎姆",
    		artistName: "SIXMOREVODKA",
    		name: "鋼鐵脆化",
    		cardCode: "01FR030",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX014-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "此牌對主堡造成雙倍傷害。",
    		descriptionRaw: "此牌對主堡造成雙倍傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「他說什麼？！那人真是腦袋裝水泥。那雙厚實的肩膀倒是無可挑剔……」",
    		artistName: "SIXMOREVODKA",
    		name: "雙刃手席菈扎",
    		cardCode: "01NX014",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI012-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：賦予手牌中1個友軍單位<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>，且魔耗值-1。",
    		descriptionRaw: "出牌：賦予手牌中1個友軍單位閃靈，且魔耗值-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "噢，可憐的傢伙……",
    		artistName: "SIXMOREVODKA",
    		name: "不知情的島民",
    		cardCode: "01SI012",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI052",
    			"01SI052T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI052T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI052T2-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "對本回合召喚的每個敵軍單位造成3點傷害。\r\n將1張<link=card.level1><style=AssociatedCard>瑟雷西</style></link>洗入我方牌組。",
    		descriptionRaw: "對本回合召喚的每個敵軍單位造成3點傷害。\r\n將1張瑟雷西洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「沒人逃得了。」——瑟雷西",
    		artistName: "Kudos Productions",
    		name: "瑟雷西 惡靈領域",
    		cardCode: "01SI052T2",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ001-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "棄置2張牌，接著抽2張牌。\r\n若手牌中除此牌外只剩1張牌，則棄置該牌，接著抽1張牌。",
    		descriptionRaw: "棄置2張牌，接著抽2張牌。\r\n若手牌中除此牌外只剩1張牌，則棄置該牌，接著抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「噢～老天，五名特警還有一個石像？等等！我有個法寶！放去哪裡啦……」——吉茵珂絲",
    		artistName: "Max Grecke",
    		name: "雜物堆",
    		cardCode: "01PZ001",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX042",
    			"01NX042T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX042T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX042T2-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 4,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：進行<link=vocab.Rally><style=Vocab>備戰</style></link>。\r\n<link=vocab.Strike><style=Vocab>打擊</style></link>：<link=keyword.Recall><style=Keyword>召回</style></link>此牌。",
    		descriptionRaw: "出牌：進行備戰。\r\n打擊：召回此牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「不，長官！只有一抹紅光。下一秒我抬起頭……眼前就成了這副屠宰場的景象。」——蒂瑪西亞邊境守衛",
    		artistName: "SIXMOREVODKA",
    		name: "卡特蓮娜",
    		cardCode: "01NX042T2",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR013.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR013-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 6,
    		health: 8,
    		description: "此牌承受傷害且未陣亡時，賦予此牌+3|+0。",
    		descriptionRaw: "此牌承受傷害且未陣亡時，賦予此牌+3|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我寧可在冰天雪地發抖凍死，也不屑與艾希那群弱者共享一座爐火。但若是他們想要讓身子熱一熱，我就如他們所願。」",
    		artistName: "SIXMOREVODKA",
    		name: "戰痕之母芙蕊娜",
    		cardCode: "01FR013",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ032"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ057.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ057-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "召喚2個<link=card.summon><style=AssociatedCard>廢料河蟹</style></link>。",
    		descriptionRaw: "召喚2個廢料河蟹。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "兩隻溫和的生物曾隔著陸地遙遙相對，如今終於藉著汙水坑的微溫水域聚首。",
    		artistName: "Kudos Productions",
    		name: "巧遇",
    		cardCode: "01PZ057",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI031.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI031-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 3,
    		health: 4,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link> ：場上每有1個<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>友軍單位，則賦予此牌+1|+0。",
    		descriptionRaw: "攻擊 ：場上每有1個閃靈友軍單位，則賦予此牌+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "不論生前死後，他都站在前線吼出扭曲黑暗的命令。而不論生前死後，赫克林的忠心騎士定會齊聲回應，衝鋒殺敵。",
    		artistName: "SIXMOREVODKA",
    		name: "幽鐵宣令官",
    		cardCode: "01SI031",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI034.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI034-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "若本回合有友軍單位陣亡，則可對1個單位造成3點傷害。",
    		descriptionRaw: "若本回合有友軍單位陣亡，則可對1個單位造成3點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「黑矛為墮落的靈魂吟唱。」——克黎思妲",
    		artistName: "Wild Blue Studios",
    		name: "靈魂黑矛",
    		cardCode: "01SI034",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI043.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI043-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：召喚1個<link=card.summon><style=AssociatedCard>小蜘蛛</style></link>。",
    		descriptionRaw: "遺願：召喚1個小蜘蛛。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「伊、伊莉絲夫人？妳……妳上哪去了？」",
    		artistName: "SIXMOREVODKA",
    		name: "倒楣的貴族",
    		cardCode: "01SI043",
    		keywords: [
    			"遺願"
    		],
    		keywordRefs: [
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO018-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "本回合給予1個友軍單位+1|+0與<link=keyword.Quick Strike><sprite name=QuickStrike><style=Keyword>快速攻擊</style></link>。",
    		descriptionRaw: "本回合給予1個友軍單位+1|+0與快速攻擊。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "戰鬥只不過是一場比賽，看誰能更快奪走對方性命。",
    		artistName: "Kudos Productions",
    		name: "急速猛攻",
    		cardCode: "01IO018",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ056",
    			"01PZ056T10"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T3-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "抽3張牌，使其魔耗值各-1。\r\n將1張<link=card.level1><style=AssociatedCard>漢默丁格</style></link>洗入我方牌組。",
    		descriptionRaw: "抽3張牌，使其魔耗值各-1。\r\n將1張漢默丁格洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "進步日！\n一起來太陽門廣場！\n見證海克斯科技奇蹟！\n令人大開眼界的大膽普羅！\n聆聽洞悉明日之人暢談今日局面\n免費入場！\n歡迎皮爾托福的孩子共襄盛舉！",
    		artistName: "Kudos Productions",
    		name: "漢默丁格 進步日！",
    		cardCode: "01PZ056T3",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR019-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "擊殺所有力量值0的敵軍單位，接著<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>所有敵軍單位。",
    		descriptionRaw: "擊殺所有力量值0的敵軍單位，接著凍傷所有敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "戰爭之母凜冬是任何意圖侵略弗雷爾卓德之人必須面對的最初和最後的敵人。她的血誓盟侶為無情狂風和刺骨冰霜。",
    		artistName: "SIXMOREVODKA",
    		name: "凜冬吐息",
    		cardCode: "01FR019",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE033.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE033-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "本回合每有1個友軍單位陣亡，則此牌魔耗值-1。隨機召喚1個魔耗值5的蒂瑪西亞侍從單位。",
    		descriptionRaw: "本回合每有1個友軍單位陣亡，則此牌魔耗值-1。隨機召喚1個魔耗值5的蒂瑪西亞侍從單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「為了替前人撥亂反正，今日我們挺身而出。我們同袍的犧牲絕非枉然。」——光輝守護者",
    		artistName: "Original Force",
    		name: "緬懷先烈",
    		cardCode: "01DE033",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI009-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：賦予此牌支援的友軍單位+2|+0與<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。",
    		descriptionRaw: "支援：賦予此牌支援的友軍單位+2|+0與閃靈。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "有些人只在殞落王者的詛咒中看見毀滅與痛苦，有些人卻能抱著「今朝有酒今朝醉」的心態，及時行樂去囉。",
    		artistName: "SIXMOREVODKA",
    		name: "騷靈酒鬼",
    		cardCode: "01SI009",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ027.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ027-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "用盡所有魔力即可出此牌。\r\n<style=Variable>對1個單位造成等同消耗魔力的傷害。</style>",
    		descriptionRaw: "用盡所有魔力即可出此牌。\r\n對1個單位造成等同消耗魔力的傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們耗盡了時間和資金，儘管現在光束能正常運作，我們仍無法調節光束消耗的能量。」——佐恩實驗家",
    		artistName: "Max Grecke",
    		name: "生熱光束",
    		cardCode: "01PZ027",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE045T2",
    			"01DE045"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE045T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE045T1-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 3,
    		health: 4,
    		description: "此牌擊殺4個敵軍並存活，我方即贏下牌局。<style=Variable></style>",
    		descriptionRaw: "此牌擊殺4個敵軍並存活，我方即贏下牌局。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「現在我懂了。」",
    		artistName: "SIXMOREVODKA",
    		name: "菲歐拉",
    		cardCode: "01DE045T1",
    		keywords: [
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR041.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR041-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 5,
    		cost: 5,
    		health: 5,
    		description: "召喚此牌時，賦予牌組中友軍單位+1|+1。",
    		descriptionRaw: "召喚此牌時，賦予牌組中友軍單位+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「眾多部族為了同一面旗幟而戰！或許終有一天，弗雷爾卓德全體能齊心禦敵。」",
    		artistName: "SIXMOREVODKA",
    		name: "艾伐洛森爐衛",
    		cardCode: "01FR041",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX051.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX051-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 8,
    		cost: 8,
    		health: 8,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：將我方手牌全部替換成<link=card.Devastate><style=AssociatedCard>毀滅風暴</style></link>。",
    		descriptionRaw: "出牌：將我方手牌全部替換成毀滅風暴。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "出身佐恩汙水坑的班恩．法隆從小被佐恩人視為殘暴、性情無常之人，並遭到排擠。加入諾克薩斯軍團後，法隆受到接納、賞識，成為無人能敵的武將。",
    		artistName: "SIXMOREVODKA",
    		name: "法隆上尉",
    		cardCode: "01NX051",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR025.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR025-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 4,
    		health: 4,
    		description: "召喚此牌時，若場上有普羅單位，則抽2張普羅牌。",
    		descriptionRaw: "召喚此牌時，若場上有普羅單位，則抽2張普羅牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "照顧牧群只有兩個重點：愛與陪伴。其他的都只是吹毛求疵罷了。\n",
    		artistName: "SIXMOREVODKA",
    		name: "普羅牧人",
    		cardCode: "01FR025",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE042",
    			"01DE042T1",
    			"01DE042T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE042T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE042T2-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 5,
    		cost: 6,
    		health: 6,
    		description: "此牌在場上時，若我方消耗6點或更多魔力施放法術，則在手牌生成一張<link=card.warcry><style=AssociatedCard>終極閃光</style></link>。<style=Variable></style>",
    		descriptionRaw: "此牌在場上時，若我方消耗6點或更多魔力施放法術，則在手牌生成一張終極閃光。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我不會再壓抑了！」",
    		artistName: "SIXMOREVODKA",
    		name: "拉克絲",
    		cardCode: "01DE042T2",
    		keywords: [
    			"光盾"
    		],
    		keywordRefs: [
    			"Barrier"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX012-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 1,
    		health: 2,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "諾克薩斯的士兵在戰場上以驍勇善戰聞名，因此擔任後衛簡直是一種懲罰。",
    		artistName: "SIXMOREVODKA",
    		name: "軍團後衛",
    		cardCode: "01NX012",
    		keywords: [
    			"無法進行格檔"
    		],
    		keywordRefs: [
    			"CantBlock"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE024.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE024-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：在手牌生成1張魔耗值6點或以上法術，必不屬於蒂瑪西亞區域。",
    		descriptionRaw: "遺願：在手牌生成1張魔耗值6點或以上法術，必不屬於蒂瑪西亞區域。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「雖然奧術物品擁有不可言喻的迷人風采。但這些充滿力量的物品必須交到可靠的專家手上，遠離我們善良無知的市民為上策。」——獵魔者手冊",
    		artistName: "SIXMOREVODKA",
    		name: "獵魔監管員",
    		cardCode: "01DE024",
    		keywords: [
    			"遺願"
    		],
    		keywordRefs: [
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI007T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI007T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "……每個靈魂都是受到聖物誘惑的受害者。它們默默地翻騰，耐心等待下一個貪婪愚人的到來。",
    		artistName: "SIXMOREVODKA",
    		name: "獲釋的靈魂",
    		cardCode: "01SI007T1",
    		keywords: [
    			"閃靈"
    		],
    		keywordRefs: [
    			"Ephemeral"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE056.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE056-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 2,
    		cost: 4,
    		health: 2,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：賦予此牌+2|+2。",
    		descriptionRaw: "攻擊：賦予此牌+2|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "才聽見戰場上的吶喊聲，我的雙腳已經蠢蠢欲動，準備衝鋒陷陣。只要她一聲令下，我將無條件獻上性命，貫徹她的意志。",
    		artistName: "SIXMOREVODKA",
    		name: "先鋒首刃軍",
    		cardCode: "01DE056",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "菁英",
    		subtypes: [
    			"菁英"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX043.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX043-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "對任一目標造成1點傷害。",
    		descriptionRaw: "對任一目標造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「刀刃在對的人手中，就能切斷一切……我是說真的。」——卡特蓮娜",
    		artistName: "SIXMOREVODKA",
    		name: "利刃刀鋒",
    		cardCode: "01NX043",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE030.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE030-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 2,
    		cost: 4,
    		health: 3,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "大批箭雨從城牆直瀉而下，但怎麼也傷不了那劃破長空的銀色斑點。 ",
    		artistName: "SIXMOREVODKA",
    		name: "銀翼鷲俯擊兵",
    		cardCode: "01DE030",
    		keywords: [
    			"隱密",
    			"堅忍"
    		],
    		keywordRefs: [
    			"Elusive",
    			"Tough"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO056T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO056T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>2個敵軍單位。",
    		descriptionRaw: "擊暈2個敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「讓開。我是為了放逐浪人而來。」——追風者．犽凝",
    		artistName: "Kudos Productions",
    		name: "震撼雙擊",
    		cardCode: "01IO056T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI030",
    			"01SI030T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI030T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI030T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "若本回合有友軍單位陣亡，則可對1個單位造成3點傷害。\r\n將1張<link=card.level1><style=AssociatedCard>克黎思妲</style></link>洗入我方牌組。",
    		descriptionRaw: "若本回合有友軍單位陣亡，則可對1個單位造成3點傷害。\r\n將1張克黎思妲洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「黑矛為墮落的靈魂吟唱。」——克黎思妲",
    		artistName: "Wild Blue Studios",
    		name: "克黎思妲 靈魂黑矛",
    		cardCode: "01SI030T1",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX037.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX037-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 2,
    		health: 1,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：對敵方主堡造成2點傷害。",
    		descriptionRaw: "遺願：對敵方主堡造成2點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "諾克薩斯人從小就受到教誨，加入軍團效忠帝國就能光榮一生。不過只有少數人能獲得擔任軍團擲彈兵的殊榮。",
    		artistName: "SIXMOREVODKA",
    		name: "軍團擲彈兵",
    		cardCode: "01NX037",
    		keywords: [
    			"遺願"
    		],
    		keywordRefs: [
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX002-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "對敵方主堡造成4點傷害。",
    		descriptionRaw: "對敵方主堡造成4點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「攻城這檔事，有時候必須仰賴天才軍師，有時候只要更猛烈攻擊就行了。」——達瑞斯",
    		artistName: "Max Grecke",
    		name: "毀滅風暴",
    		cardCode: "01NX002",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO016-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 6,
    		health: 4,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：在手牌生成1張牌的複製牌。",
    		descriptionRaw: "出牌：在手牌生成1張牌的複製牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「長老安慰戰敗的悲泣戰士：『去尋找諸天之上的聖者吧。唯有他能尋回仍留在記憶中的失物』。」——《最初淨土傳說》",
    		artistName: "SIXMOREVODKA",
    		name: "西風聖者",
    		cardCode: "01IO016",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI056.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI056-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "召喚此牌時，本回合給予我方蜘蛛單位+1|+0，並使敵軍單位<nobr>-1|-0</nobr>。",
    		descriptionRaw: "召喚此牌時，本回合給予我方蜘蛛單位+1|+0，並使敵軍單位-1|-0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「牠們不用一分鐘就能吐絲纏捆一個人……需要示範一下嗎？」——伊莉絲",
    		artistName: "SIXMOREVODKA",
    		name: "發狂疾行蛛",
    		cardCode: "01SI056",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "蜘蛛",
    		subtypes: [
    			"蜘蛛"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX010-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 4,
    		cost: 5,
    		health: 4,
    		description: "召喚此牌時，本牌局我方每<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>或<link=keyword.Recall><style=Keyword>召回</style></link>1個單位，則賦予此牌+1|+1。<style=Variable></style>",
    		descriptionRaw: "召喚此牌時，本牌局我方每擊暈或召回1個單位，則賦予此牌+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "所有諾克薩斯人都知曉帝國強盛的三大法則，但是假如士兵想尋求晉升機會，他們必須學會活用三大法則。",
    		artistName: "SIXMOREVODKA",
    		name: "軍團大將軍",
    		cardCode: "01NX010",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX017-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：本回合給予此牌支援的友軍單位<link=keyword.Quick Strike><sprite name=QuickStrike><style=Keyword>快速攻擊</style></link>。",
    		descriptionRaw: "支援：本回合給予此牌支援的友軍單位快速攻擊。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "隨著她的鏗鏘鼓聲，軍團步步侵略，擴張帝國版圖。他們無人可擋。事實上也從來沒人擋得住。",
    		artistName: "SIXMOREVODKA",
    		name: "軍團擂鼓兵",
    		cardCode: "01NX017",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE004-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 2,
    		cost: 4,
    		health: 1,
    		description: "召喚此牌時，再召喚1個與此牌相同的複製單位。",
    		descriptionRaw: "召喚此牌時，再召喚1個與此牌相同的複製單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "牠們穿破雲層，宛如一道道銀色閃電敏捷且精準地向目標俯衝。來無影，去無蹤。 ",
    		artistName: "SIXMOREVODKA",
    		name: "銀翼鷲先鋒",
    		cardCode: "01DE004",
    		keywords: [
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "菁英",
    		subtypes: [
    			"菁英"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI001-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "擊殺1個單位。",
    		descriptionRaw: "擊殺1個單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "遭到背叛的人們在垂死之際，乞求克黎思妲持黑矛為他們復仇。",
    		artistName: "Max Grecke",
    		name: "復仇",
    		cardCode: "01SI001",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE011-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 2,
    		cost: 3,
    		health: 4,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「他做了什麼好事？我把貴重的古拉德．皮耶平衡雙刀託付給他！他明明說只會拿去進行訓練！」——羅倫特刀劍收藏家",
    		artistName: "SIXMOREVODKA",
    		name: "羅倫特家族門徒",
    		cardCode: "01DE011",
    		keywords: [
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO036.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO036-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 2,
    		health: 1,
    		description: "<link=vocab.Strike><style=Vocab>打擊</style></link>：手牌中魔耗值最高的單位魔耗值-1。",
    		descriptionRaw: "打擊：手牌中魔耗值最高的單位魔耗值-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「巡邏兵，有一……不對……兩隻巨型毛茸生物朝著我們過來了！呼叫支——喔，等等，望遠鏡又拿反了……」",
    		artistName: "SIXMOREVODKA",
    		name: "林地瞭望兵",
    		cardCode: "01IO036",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ055.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ055-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 1,
    		health: 2,
    		description: "我方抽牌時，本回合給予此牌+1|+0。",
    		descriptionRaw: "我方抽牌時，本回合給予此牌+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "想像力是偉大發明的火花，不過潛心研究才能讓火花點燃為大火。",
    		artistName: "SIXMOREVODKA",
    		name: "聰慧學者",
    		cardCode: "01PZ055",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ008T2",
    			"01PZ022",
    			"01PZ008T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ008-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "<link=vocab.Nexus Strike><style=Vocab>打擊主堡</style></link>：將5張<link=card.shuffle><style=AssociatedCard>劇毒膨菇</style></link>隨機植入敵方牌組。",
    		descriptionRaw: "打擊主堡：將5張劇毒膨菇隨機植入敵方牌組。",
    		levelupDescription: "把15張或以上<link=card.shuffle><style=AssociatedCard>劇毒膨菇</style></link>植入敵方牌組<style=Variable></style>。",
    		levelupDescriptionRaw: "把15張或以上劇毒膨菇植入敵方牌組。",
    		flavorText: "「班德爾偵察隊第154條守則：未知不足以為懼！第276條守則：森林居民是我們的朋友！第354條守則：毛茸茸的東西或許可以摸，但絕對不能吃！第417條守則……」",
    		artistName: "SIXMOREVODKA",
    		name: "提摩",
    		cardCode: "01PZ008",
    		keywords: [
    			"隱密"
    		],
    		keywordRefs: [
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T2-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 5,
    		cost: 5,
    		health: 1,
    		description: "<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。",
    		descriptionRaw: "飛逝。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「製造過程經歷幾次推進器和導引系統的問題後，新發明終於準備好亮相啦：推進可燃物！……得再想個更響亮的名字才行。」——《漢默丁格的實驗室手札》第5冊",
    		artistName: "SIXMOREVODKA",
    		name: "Mk5：火箭轟爆槍",
    		cardCode: "01PZ056T2",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "科技",
    		subtypes: [
    			"科技"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ014T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ014-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "召喚1個<link=card.summon><style=AssociatedCard>非法怪裝置</style></link>。",
    		descriptionRaw: "召喚1個非法怪裝置。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「他們搞出來的禍端還可以分成多種風味：遠方爆炸的震動、裂隙飄出的腐臭濃煙。這些蠢蛋遲早會把這座城市毀了。」——皮爾托福慈善家",
    		artistName: "Kudos Productions",
    		name: "無照新發明",
    		cardCode: "01PZ014",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE016"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE047.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE047-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "召喚1個<link=card.summon><style=AssociatedCard>無畏先鋒</style></link>。",
    		descriptionRaw: "召喚1個無畏先鋒。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "無畏先鋒的聖衣在一位又一位的兵士手中傳遞。如此一來，剛入伍的新兵才會感受到身負大任的重量與驕傲。",
    		artistName: "Kudos Productions",
    		name: "天降大任",
    		cardCode: "01DE047",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX003-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 3,
    		health: 1,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始：</style></link>棄置我方手牌魔耗值最低的牌，並抽1張牌。",
    		descriptionRaw: "回合開始：棄置我方手牌魔耗值最低的牌，並抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「……你賭席菈扎會是場上唯一的生還者。但那個愛歐尼亞小子只是斷了一隻手臂，他還沒死。所以他也是生還者，懂嗎？當然，你也可以選擇加倍下注……」",
    		artistName: "SIXMOREVODKA",
    		name: "競技場組頭",
    		cardCode: "01NX003",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX011-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "使1名戰鬥中友軍單位<link=vocab.Strike><style=Vocab>打擊</style></link>1名戰鬥中敵軍單位。",
    		descriptionRaw: "使1名戰鬥中友軍單位打擊1名戰鬥中敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我最愛這份工作了！」——達瑞文",
    		artistName: "Rafael Zanchetin",
    		name: "迴轉死神",
    		cardCode: "01NX011",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE046.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE046-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 1,
    		cost: 2,
    		health: 4,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "安靜無聲不代表安全無虞。",
    		artistName: "SIXMOREVODKA",
    		name: "先鋒瞭望兵",
    		cardCode: "01DE046",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "菁英",
    		subtypes: [
    			"菁英"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR054.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR054-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 4,
    		cost: 5,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「弱者坐等收成，強者逕行奪取。弱小的艾伐洛森人將會認清自己屬於哪一種！」",
    		artistName: "SIXMOREVODKA",
    		name: "戰痕少女掠奪者",
    		cardCode: "01FR054",
    		keywords: [
    			"勢不可擋",
    			"再生"
    		],
    		keywordRefs: [
    			"Overwhelm",
    			"Regeneration"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE050.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE050-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "<link=vocab.Silence><style=Vocab>沉默</style></link>1個侍從單位。",
    		descriptionRaw: "沉默1個侍從單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「反魔法英石灰色印徽是對抗魔法的基本防護，象徵我們的責任，也提醒旁人我們的權威性。從現在起，這個印徽就是你的最高榮譽。」——獵魔者手冊",
    		artistName: "Kudos Productions",
    		name: "淨化",
    		cardCode: "01DE050",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR021T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR021T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對所有戰鬥中單位造成1點傷害。",
    		descriptionRaw: "對所有戰鬥中單位造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「……看來也不是那麼有風度啦。」——泰達米爾",
    		artistName: "Max Grecke",
    		name: "塔卡茲之怒",
    		cardCode: "01FR021T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR043T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR043.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR043-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 4,
    		cost: 6,
    		health: 4,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：將所有我方場上的普羅結合成為1個<link=card.transform><style=AssociatedCard>普羅成群</style></link>，它能獲得所有的能力值與特性。",
    		descriptionRaw: "出牌：將所有我方場上的普羅結合成為1個普羅成群，它能獲得所有的能力值與特性。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我再說一個故事，但要保持安靜，不然戰爭之母就來了！\n很久以前，盜匪攻擊艾伐洛森的村莊。她的部隊只有幾人，通通看起來很迷茫。不過這時一隻普羅出現並對艾伐洛森伸出援手……」",
    		artistName: "SIXMOREVODKA",
    		name: "毛茸茸之心",
    		cardCode: "01FR043",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "普羅",
    		subtypes: [
    			"普羅"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR049T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR049T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「不管是狼還是野兔，我們全都是冬天的獵物。」——艾伐洛森諺語",
    		artistName: "SIXMOREVODKA",
    		name: "雪兔",
    		cardCode: "01FR049T1",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR033.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR033-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 3,
    		health: 4,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：本回合額外獲得1顆魔力寶石。",
    		descriptionRaw: "回合開始：本回合額外獲得1顆魔力寶石。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「遠古石堆時時提醒著我們，自己不過是部族長久歷史中，勇敢拓荒不馴之地的其中一群人。」——艾希",
    		artistName: "SIXMOREVODKA",
    		name: "玄妙石陣",
    		cardCode: "01FR033",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI019-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "對本回合召喚的每個敵軍單位造成3點傷害。",
    		descriptionRaw: "對本回合召喚的每個敵軍單位造成3點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「沒人逃得了。」——瑟雷西",
    		artistName: "Kudos Productions",
    		name: "惡靈領域",
    		cardCode: "01SI019",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE042T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE042T3-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對1個敵軍單位造成4點傷害。<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。",
    		descriptionRaw: "對1個敵軍單位造成4點傷害。飛逝。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我竭盡一生把光芒醞藏起來。要是他們知道……要是我知道自己握有什麼力量，會發生什麼事？」——拉克絲",
    		artistName: "Kudos Productions",
    		name: "終極閃光",
    		cardCode: "01DE042T3",
    		keywords: [
    			"慢速",
    			"勢不可擋",
    			"飛逝"
    		],
    		keywordRefs: [
    			"Slow",
    			"SpellOverwhelm",
    			"Fleeting"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO033T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO033.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO033-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 6,
    		cost: 9,
    		health: 5,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：<link=keyword.Recall><style=Keyword>召回</style></link>3個敵軍單位。",
    		descriptionRaw: "出牌：召回3個敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們當時正在草地上疾行，這個小鬼忽然不知道從哪裡跳出來，砰、砰、砰地踢到我們呼吸困難！」——那歐竊匪",
    		artistName: "SIXMOREVODKA",
    		name: "迅腿米娜",
    		cardCode: "01IO033",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX039.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX039-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "施放或棄置時，賦予所有友軍單位+1|+0。",
    		descriptionRaw: "施放或棄置時，賦予所有友軍單位+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「無法預知未來之人，未來將無立足之地。」——傑利科．斯溫",
    		artistName: "Kudos Productions",
    		name: "洞察力",
    		cardCode: "01NX039",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR011-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 2,
    		health: 1,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>1個敵軍單位。",
    		descriptionRaw: "出牌：凍傷1個敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "能夠適應嚴峻天候和冰封凍土，讓艾伐洛森人引以為傲。目光銳利的守軍更是進一步把自然地勢轉成防禦優勢。 ",
    		artistName: "SIXMOREVODKA",
    		name: "冰谷弓箭手",
    		cardCode: "01FR011",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ026"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ034.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ034-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 4,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Allegiance><style=Vocab>效忠</style></link>：在手牌生成1張<link=card.create><style=AssociatedCard>汙水坑地圖</style></link>。本回合該牌的魔耗值為0。",
    		descriptionRaw: "效忠：在手牌生成1張汙水坑地圖。本回合該牌的魔耗值為0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "佐恩的孩子們很快就開始探索老礦坑隧道，深入街巷阡陌。他們發現了另一番天地，還結交到許多摯友。\n",
    		artistName: "SIXMOREVODKA",
    		name: "汙水坑拾荒者",
    		cardCode: "01PZ034",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR004-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "本回合給予1個友軍單位+0|+2。",
    		descriptionRaw: "本回合給予1個友軍單位+0|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「外面天氣糟透了，對吧？別擔心，『微醺貓頭鷹』的特殊佳釀口感強烈，能夠驅走你骨子裡的寒意，還能讓新生兒長出胸毛喔！」——親切的小酒館老闆",
    		artistName: "SIXMOREVODKA",
    		name: "抗擊魔藥",
    		cardCode: "01FR004",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR050.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR050-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 2,
    		cost: 3,
    		health: 3,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：治癒1個友軍單位或我方主堡3點生命。",
    		descriptionRaw: "出牌：治癒1個友軍單位或我方主堡3點生命。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「這棟老建築就是『微醺貓頭鷹』，我們有各式燉菜和佳釀幫你驅走寒意，快進來吧！」",
    		artistName: "SIXMOREVODKA",
    		name: "親切的小酒館老闆",
    		cardCode: "01FR050",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ014T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ014T1-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 5,
    		cost: 6,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「絕對不是正規硬體設備。」——皮爾托福安全檢查局",
    		artistName: "SIXMOREVODKA",
    		name: "非法怪裝置",
    		cardCode: "01PZ014T1",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX041.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX041-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 6,
    		cost: 5,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我沒耐心慢慢圍城，派破盾兵上場。」——達瑞斯",
    		artistName: "SIXMOREVODKA",
    		name: "特菲利安破盾兵",
    		cardCode: "01NX041",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR039",
    			"01FR039T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR039T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR039T2-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 9,
    		cost: 8,
    		health: 9,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「...讓他們付出生命作為代價。」",
    		artistName: "SIXMOREVODKA",
    		name: "泰達米爾",
    		cardCode: "01FR039T2",
    		keywords: [
    			"勢不可擋",
    			"威嚇"
    		],
    		keywordRefs: [
    			"Overwhelm",
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR038T3",
    			"01FR038T1",
    			"01FR038"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR038T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR038T2-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 6,
    		cost: 4,
    		health: 4,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link><link=vocab.Strongest><style=Vocab>最強</style></link>的敵軍單位。\r\n力量值0的敵軍單位無法進行格檔。",
    		descriptionRaw: "攻擊：凍傷最強的敵軍單位。\r\n力量值0的敵軍單位無法進行格檔。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你我不是敵人，無法無天的漫長冬季才是真正的仇敵。我們都是弗雷爾卓德的子民，這片土地歸屬我們全體！」 ",
    		artistName: "SIXMOREVODKA",
    		name: "艾希",
    		cardCode: "01FR038T2",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ033T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ060.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ060-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "若我方在本牌局打出<style=Variable>15</style>張不同名稱的卡牌，則召喚1個<link=card.summon><style=AssociatedCard>貓劫降臨</style></link>。<style=Variable></style>",
    		descriptionRaw: "若我方在本牌局打出15張不同名稱的卡牌，則召喚1個貓劫降臨。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「到頭來，為了馮奕卜的願景而付出努力的所有人都被蒙在鼓裡。我們對後果一無所知，不曉得自己即將釋放多麼恐怖的力量。」——皮爾托福專案工程師",
    		artistName: "Kudos Productions",
    		name: "速成完喵",
    		cardCode: "01PZ060",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO015T1",
    			"01IO015T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO015.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO015-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 4,
    		health: 4,
    		description: "我方<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>或<link=keyword.Recall><style=Keyword>召回</style></link>1個敵軍單位時，此牌對該單位造成2點傷害。",
    		descriptionRaw: "我方擊暈或召回1個敵軍單位時，此牌對該單位造成2點傷害。",
    		levelupDescription: "我方<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>或<link=keyword.Recall><style=Keyword>召回</style></link>5個或以上單位<style=Variable></style>。",
    		levelupDescriptionRaw: "我方擊暈或召回5個或以上單位。",
    		flavorText: "「死亡就像風...」",
    		artistName: "SIXMOREVODKA",
    		name: "犽宿",
    		cardCode: "01IO015",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO001-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "治癒1個友軍單位或我方主堡7點生命。抽1張牌。",
    		descriptionRaw: "治癒1個友軍單位或我方主堡7點生命。抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「唯有提高心靈層次，肉身才能變得完整。」——卡瑪",
    		artistName: "Kudos Productions",
    		name: "重生儀式",
    		cardCode: "01IO001",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE016-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "無畏先鋒是蒂瑪西亞戰士中的最強菁英，每位都是故鄉的傳奇人物。不過他們全都希望自己的名字能在王國中家喻戶曉。",
    		artistName: "SIXMOREVODKA",
    		name: "無畏先鋒",
    		cardCode: "01DE016",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "菁英",
    		subtypes: [
    			"菁英"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO010-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "調換2個友軍單位位置，並在本回合給予其<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。",
    		descriptionRaw: "調換2個友軍單位位置，並在本回合給予其光盾。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我會跟隨均衡的步伐前行。」——慎\n",
    		artistName: "SIXMOREVODKA",
    		name: "並肩作戰",
    		cardCode: "01IO010",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO012-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予1個友軍單位+3|+0或+0|+3。",
    		descriptionRaw: "本回合給予1個友軍單位+3|+0或+0|+3。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「不必害怕改變。改變會讓你自省，並考驗你的極限，是我們最棒的導師。」——卡瑪",
    		artistName: "SIXMOREVODKA",
    		name: "雙重戒律",
    		cardCode: "01IO012",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR052T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR052T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "<link=keyword.Obliterate><style=Keyword>泯滅</style></link>手牌及場上所有力量值4或以下的侍從單位。",
    		descriptionRaw: "泯滅手牌及場上所有力量值4或以下的侍從單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「怪異光線灑滿了整座峽谷，一聲尖銳呼嘯把懸崖上的岩石震得喀喀作響，晃得我差點筋骨分離，腦中一片空白！接著……鴉雀無聲。」——漫遊者比亞",
    		artistName: "Max Grecke",
    		name: "虛厄光景",
    		cardCode: "01FR052T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE040.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE040-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "若我方在本牌局已施放1張魔耗值6點或以上的法術牌，則賦予此牌+1|+1與<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。",
    		descriptionRaw: "若我方在本牌局已施放1張魔耗值6點或以上的法術牌，則賦予此牌+1|+1與挑戰者。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「蒂瑪西亞的人民，保護你們的安全是我的榮幸。不過，我們需要各位堅定不移的支持。因為即使在高聳的城牆內，仍有魔法師混在我們當中！」\n",
    		artistName: "SIXMOREVODKA",
    		name: "獵魔宣教士",
    		cardCode: "01DE040",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX036.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX036-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 6,
    		cost: 6,
    		health: 6,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link><link=keyword.Weakest><style=Keyword>最弱</style></link>的敵軍。",
    		descriptionRaw: "回合開始：擊暈最弱的敵軍。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我不在乎你的仇家是誰，也不在乎對方幹了什麼。想要我替你在場上報仇，就得先拿出銀子。就算情節慘絕人寰，價碼一樣不變。」",
    		artistName: "SIXMOREVODKA",
    		name: "牛頭怪角鬥士",
    		cardCode: "01NX036",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX044.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX044-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 6,
    		health: 12,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：賦予此牌+4|+0。",
    		descriptionRaw: "攻擊：賦予此牌+4|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「長官，敵方拒絕打開城門。他們要求跟達瑞斯談話，但他還有兩天的路程。該派騎士去找他嗎？」\n「沒有這個必要。」",
    		artistName: "SIXMOREVODKA",
    		name: "攻城槌",
    		cardCode: "01NX044",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE036.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE036-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "每召喚1個菁英單位時，使此牌魔耗值-1。",
    		descriptionRaw: "每召喚1個菁英單位時，使此牌魔耗值-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我所經歷的每趟旅程、遇見的每個人，都教會我新事物。但是看得越多，變得越強，我才發現要走的路還漫長得很……」——先鋒護衛希莉亞\n",
    		artistName: "SIXMOREVODKA",
    		name: "先鋒護衛",
    		cardCode: "01DE036",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "菁英",
    		subtypes: [
    			"菁英"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI011-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 3,
    		cost: 0,
    		health: 2,
    		description: "擊殺1個友軍單位即可出此牌。",
    		descriptionRaw: "擊殺1個友軍單位即可出此牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "人如其食。",
    		artistName: "SIXMOREVODKA",
    		name: "無饜屠夫",
    		cardCode: "01SI011",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO009T1",
    			"01IO009",
    			"01IO009T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO009T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO009T3-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "<link=keyword.Recall><style=Keyword>召回</style></link>1個友軍單位，召喚1個<link=card.create><style=AssociatedCard>疾風殘影</style></link>取而代之。\r\n將1張<link=card.level1><style=AssociatedCard>劫</style></link>洗入我方牌組。",
    		descriptionRaw: "召回1個友軍單位，召喚1個疾風殘影取而代之。\r\n將1張劫洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "你眼前的敵人確實存在嗎？還是說，它只是暗影的障眼法？",
    		artistName: "Max Grecke",
    		name: "劫 移形換影",
    		cardCode: "01IO009T3",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI042",
    			"01SI042T1",
    			"01SI024"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI042T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI042T2-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "召喚2個<link=card.summon><style=AssociatedCard>幽魂騎士</style></link>。\r\n將1張<link=card.level1><style=AssociatedCard>赫克林</style></link>洗入我方牌組。",
    		descriptionRaw: "召喚2個幽魂騎士。\r\n將1張赫克林洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "彼時殂落此時生，牠們始終忠心如一。",
    		artistName: "Kudos Productions",
    		name: "赫克林 暗影的逆襲",
    		cardCode: "01SI042T2",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE037.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE037-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "本回合給予1個友軍單位+3|+0與<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。",
    		descriptionRaw: "本回合給予1個友軍單位+3|+0與光盾。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「『你打起架就像一隻普羅』，這形容真是再貼切不過了！」——菲歐拉",
    		artistName: "Kudos Productions",
    		name: "斗轉之力",
    		cardCode: "01DE037",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T5.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T5-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 7,
    		cost: 7,
    		health: 1,
    		description: "<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。",
    		descriptionRaw: "飛逝。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我夢到一隻巨大機械獸，完全聽令行事！我一定要做出這隻機械獸。首先，進行穩定性測試，接著強化武器和護甲……」——《漢默丁格的實驗室手札》第7冊",
    		artistName: "SIXMOREVODKA",
    		name: "Mk7：裝甲重踏獸",
    		cardCode: "01PZ056T5",
    		keywords: [
    			"光盾"
    		],
    		keywordRefs: [
    			"Barrier"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "科技",
    		subtypes: [
    			"科技"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI027T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI027.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI027-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "若本回合有3個或以上友軍單位陣亡，則召喚<link=card.summon><style=AssociatedCard>威洛魔</style></link>。\r\n<style=Variable></style>",
    		descriptionRaw: "若本回合有3個或以上友軍單位陣亡，則召喚威洛魔。\r\n",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「在毒牙之神面前跪下吧。最好連性命也一併奉獻。」——伊莉絲",
    		artistName: "Kudos Productions",
    		name: "新鮮獻祭",
    		cardCode: "01SI027",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ003-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 3,
    		health: 1,
    		description: "施放法術時，賦予此牌+1|+1。",
    		descriptionRaw: "施放法術時，賦予此牌+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「任何笨蛋都能組裝機器，但要將真正的尖端科技灌輸到機械大腦裡，只有百年難得一見的奇才做得到！過不久那些該死的官僚就會乖乖爬回來找我了……」—科拉斯．漢維克",
    		artistName: "SIXMOREVODKA",
    		name: "組合機器人",
    		cardCode: "01PZ003",
    		keywords: [
    			"灌輸"
    		],
    		keywordRefs: [
    			"Imbue"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO021.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO021-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 7,
    		health: 2,
    		description: "召喚此牌時，本回合給予其他友軍單位+2|+2。",
    		descriptionRaw: "召喚此牌時，本回合給予其他友軍單位+2|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「春天的花朵首先在愛歐尼亞的峭壁綻開，新生的飛禽拍打著翅膀，沐浴在春季的輕柔微風中。」——《最初淨土傳說》",
    		artistName: "SIXMOREVODKA",
    		name: "幼年風行貓獸",
    		cardCode: "01IO021",
    		keywords: [
    			"隱密"
    		],
    		keywordRefs: [
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR016-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "賦予我方<link=vocab.Everywhere><style=Vocab>各處</style></link>的普羅+1|+1。",
    		descriptionRaw: "賦予我方各處的普羅+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「牠們先是狼吞虎嚥，然後伸出舌頭開心地看著你，彷彿融雪時節剃完毛的厄努克，跟你討更多好料！誰忍心拒絕啊。」——艾伐洛森糕點師",
    		artistName: "SIXMOREVODKA",
    		name: "普羅點心",
    		cardCode: "01FR016",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX005-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：對1個友軍單位造成1點傷害，並賦予其+2|+0。",
    		descriptionRaw: "出牌：對1個友軍單位造成1點傷害，並賦予其+2|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「新人該不會一進去就要被惡整吧？」「古老而美好的舞會儀式，真令人嚮往啊。你們會帶家人出席嗎？」「先把他們趕出家門就好啦，哈哈哈！」",
    		artistName: "SIXMOREVODKA",
    		name: "血色貴族",
    		cardCode: "01NX005",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ040T2",
    			"01PZ040",
    			"01PZ040T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ040T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ040T1-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 5,
    		cost: 4,
    		health: 4,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：抽1張牌。\r\n每回合我方第一次用盡手牌時，在手牌生成1張<link=card.create><style=AssociatedCard>超威能死亡火箭！</style></link>。",
    		descriptionRaw: "回合開始：抽1張牌。\r\n每回合我方第一次用盡手牌時，在手牌生成1張超威能死亡火箭！。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「一開始挺輕鬆有趣的，後來突然發生爆炸——表示狂歡時間到啦！」",
    		artistName: "SIXMOREVODKA",
    		name: "吉茵珂絲",
    		cardCode: "01PZ040T1",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR005-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "賦予1個友軍單位+8|+4。",
    		descriptionRaw: "賦予1個友軍單位+8|+4。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「他們說，我這個人……性情剛烈。」——泰達米爾",
    		artistName: "SIXMOREVODKA",
    		name: "戰鬥狂怒",
    		cardCode: "01FR005",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE016"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE014-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "召喚2個<link=card.summon><style=AssociatedCard>無畏先鋒</style></link>，並賦予菁英友軍單位+1|+1。",
    		descriptionRaw: "召喚2個無畏先鋒，並賦予菁英友軍單位+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們的對手深明，凡攻擊我們任何一人，就等於攻擊我們全體。」——無畏先鋒守則\n",
    		artistName: "Kudos Productions",
    		name: "增援部隊",
    		cardCode: "01DE014",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE013.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE013-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "賦予1名友軍單位<link=keyword.Tough><sprite name=Tough><style=Keyword>堅忍</style></link>。",
    		descriptionRaw: "賦予1名友軍單位堅忍。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "蒂瑪西亞之鋼因超凡強度而家喻戶曉。鐵匠需要擁有與其相當的力量和聲望方能鍛造。",
    		artistName: "Kudos Productions",
    		name: "鎖子甲",
    		cardCode: "01DE013",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO009T2",
    			"01IO009T3",
    			"01IO009T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO009-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：召喚1個攻擊中的<link=card.summon><style=AssociatedCard>疾風殘影</style></link>，其能力值與此牌相同。",
    		descriptionRaw: "攻擊：召喚1個攻擊中的疾風殘影，其能力值與此牌相同。",
    		levelupDescription: "此牌與其暗影總共<link=vocab.Strike><style=Vocab>打擊</style></link>敵方主堡兩次<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌與其暗影總共打擊敵方主堡兩次。",
    		flavorText: "「只有愚者才追求平衡。暗影向我展現了真實的力量。」",
    		artistName: "SIXMOREVODKA",
    		name: "劫",
    		cardCode: "01IO009",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX042",
    			"01NX042T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX042T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX042T1-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "對所有戰鬥中單位造成1點傷害。\r\n將1張<link=card.level1><style=AssociatedCard>卡特蓮娜</style></link>洗入我方牌組。",
    		descriptionRaw: "對所有戰鬥中單位造成1點傷害。\r\n將1張卡特蓮娜洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「跟我一起跳舞吧。」——卡特蓮娜",
    		artistName: "Rafael Zanchetin",
    		name: "卡特蓮娜 死亡蓮花",
    		cardCode: "01NX042T1",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX016-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，若場上有另一個諾克薩斯友軍單位，則賦予此牌+2|+0。",
    		descriptionRaw: "召喚此牌時，若場上有另一個諾克薩斯友軍單位，則賦予此牌+2|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「直到斧頭砍到變鈍，靴子被血水浸爛，這頭銜就歸你了。」——軍團老兵",
    		artistName: "SIXMOREVODKA",
    		name: "特菲利安新兵",
    		cardCode: "01NX016",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR009",
    			"01FR009T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR009T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR009T2-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "賦予1個負傷友軍單位+3|+3。\r\n將1張<link=card.level1><style=AssociatedCard>布郎姆</style></link>洗入我方牌組。",
    		descriptionRaw: "賦予1個負傷友軍單位+3|+3。\r\n將1張布郎姆洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「……布郎姆的傷勢頗為嚴重，他卻仰天大笑。因為他知道最艱困危急的時刻，正是英雄誕生之際！」——《布郎姆傳說》",
    		artistName: "SIXMOREVODKA",
    		name: "布郎姆 精神抖擻",
    		cardCode: "01FR009T2",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI014-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，賦予我方<link=vocab.Everywhere><style=Vocab>各處</style></link>的霧魅+1|+0。",
    		descriptionRaw: "召喚此牌時，賦予我方各處的霧魅+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "這群島上幽魂很久以前就脫離原本的身分，化成一團純粹、永不滿足的飢餓混合體。",
    		artistName: "SIXMOREVODKA",
    		name: "霧魅",
    		cardCode: "01SI014",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX027.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX027-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "本回合給予1個友軍單位+3|+0。",
    		descriptionRaw: "本回合給予1個友軍單位+3|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「張手遭拒，握拳迎擊。」——諾克薩斯格言",
    		artistName: "Kudos Productions",
    		name: "憤怒魔藥",
    		cardCode: "01NX027",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO027.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO027-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 2,
    		health: 1,
    		description: "<link=vocab.Nexus Strike><style=Vocab>打擊主堡</style></link>：在手牌生成1張此牌的複製牌。",
    		descriptionRaw: "打擊主堡：在手牌生成1張此牌的複製牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「肉體弱不禁風，不可信賴，猶如光與影的界線那樣脆弱。」",
    		artistName: "SIXMOREVODKA",
    		name: "默言影見者",
    		cardCode: "01IO027",
    		keywords: [
    			"隱密",
    			"閃靈"
    		],
    		keywordRefs: [
    			"Elusive",
    			"Ephemeral"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI007T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI007-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "召喚3個<link=card.summon><style=AssociatedCard>獲釋的靈魂</style></link>。",
    		descriptionRaw: "召喚3個獲釋的靈魂。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "生者和亡者都將這些古老聖物視為珍寶，生者一心想佔為己有，亡者則執意留在身邊。",
    		artistName: "Kudos Productions",
    		name: "鬼靈聖物",
    		cardCode: "01SI007",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI022-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "賦予1個友軍單位+2|+2與<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。",
    		descriptionRaw: "賦予1個友軍單位+2|+2與閃靈。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "欲獲力量，願付出多少代價？",
    		artistName: "Kudos Productions",
    		name: "闇影島印記",
    		cardCode: "01SI022",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO032T1",
    			"01IO032T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO032.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO032-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 4,
    		health: 5,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：給予此牌支援的友軍單位<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。",
    		descriptionRaw: "支援：給予此牌支援的友軍單位光盾。",
    		levelupDescription: "此牌在場上時友軍獲得<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>4次或以上<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌在場上時友軍獲得光盾4次或以上。",
    		flavorText: "「物質與精神領域相互纏繞，猶如緊扣的雙手...」 ",
    		artistName: "SIXMOREVODKA",
    		name: "慎",
    		cardCode: "01IO032",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX015.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX015-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "召喚此牌時，<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>本回合敵方召喚的下一個單位。 ",
    		descriptionRaw: "召喚此牌時，擊暈本回合敵方召喚的下一個單位。 ",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "所有蜘蛛她都愛，只不過這隻更得寵一點。",
    		artistName: "SIXMOREVODKA",
    		name: "寶貝毒蛛",
    		cardCode: "01NX015",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "蜘蛛",
    		subtypes: [
    			"蜘蛛"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI054.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI054-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "從1個單位<link=keyword.Drain><style=Keyword>汲取</style></link>3點生命值。",
    		descriptionRaw: "從1個單位汲取3點生命值。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "亡者別無所求，只想讓生者不間斷的心跳聲停歇下來。",
    		artistName: "Kudos Productions",
    		name: "不死之握",
    		cardCode: "01SI054",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ044T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ044.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ044-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 5,
    		cost: 5,
    		health: 2,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：對所有敵軍單位造成1點傷害。",
    		descriptionRaw: "出牌：對所有敵軍單位造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「……他的獨奏忽地轉成和聲小調，接著又彈奏起琶音——琶音是一種演奏技巧——一路滑進橋段的移調。你八成不懂得欣賞他的傑作吧。」——看門人，麥克斯．布里夫",
    		artistName: "SIXMOREVODKA",
    		name: "化學龐克撕裂樂手",
    		cardCode: "01PZ044",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR008-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "召喚此牌時，在手牌隨機生成1張不分區域、魔耗值1的普羅牌。",
    		descriptionRaw: "召喚此牌時，在手牌隨機生成1張不分區域、魔耗值1的普羅牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我在弗雷爾卓德待了一輩子，從沒見過比這難過的小傢伙更令人痛心不捨的了。」——普羅牧人",
    		artistName: "SIXMOREVODKA",
    		name: "孤單普羅",
    		cardCode: "01FR008",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "普羅",
    		subtypes: [
    			"普羅"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO041T1",
    			"01IO041T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO041.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO041-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 5,
    		health: 3,
    		description: "<link=vocab.RoundEnd><style=Vocab>回合結束：</style></link>在手牌隨機生成1張法術。",
    		descriptionRaw: "回合結束：在手牌隨機生成1張法術。",
    		levelupDescription: "我方獲得<link=keyword.Enlightened><style=Keyword>開悟</style></link>。",
    		levelupDescriptionRaw: "我方獲得開悟。",
    		flavorText: "「在自省之中，我們能專注於心，找到繞過阻礙的新路。」",
    		artistName: "SIXMOREVODKA",
    		name: "卡瑪",
    		cardCode: "01IO041",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI006-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "本回合控制1個敵軍侍從單位。（若我方場上已有6個友軍單位，則無法打出此牌）",
    		descriptionRaw: "本回合控制1個敵軍侍從單位。（若我方場上已有6個友軍單位，則無法打出此牌）",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "他睡醒發現自己雙手發紅，整個營地太過安靜，事情不對勁。 ",
    		artistName: "Kudos Productions",
    		name: "據為己有",
    		cardCode: "01SI006",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE015.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE015-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 5,
    		cost: 5,
    		health: 5,
    		description: "召喚此牌時，若本回合有友軍單位陣亡，則賦予此牌<link=keyword.Lifesteal><sprite name=Lifesteal><style=Keyword>吸血</style></link>與<link=keyword.Tough><sprite name=Tough><style=Keyword>堅忍</style></link>。",
    		descriptionRaw: "召喚此牌時，若本回合有友軍單位陣亡，則賦予此牌吸血與堅忍。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「冰冷的亡靈前仆後繼，伸出雙手將她的戰友拉下來。她隻身一人，隨著一道正義之光灑下。每次她揮舞兵刃，就彷彿在歌頌著那些捐軀將士的名字。」——蒂瑪西亞少尉",
    		artistName: "SIXMOREVODKA",
    		name: "光輝守護者",
    		cardCode: "01DE015",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ029.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ029-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：在手牌隨機生成1張史詩牌。",
    		descriptionRaw: "遺願：在手牌隨機生成1張史詩牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「以前我滿腔怒火，只懂得摧毀競爭對手，盡攬財富名聲。現在，我只把財產分送給有需要之人，希望懺悔之舉能洗清我的罪過。」",
    		artistName: "SIXMOREVODKA",
    		name: "大善人",
    		cardCode: "01PZ029",
    		keywords: [
    			"遺願"
    		],
    		keywordRefs: [
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX050.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX050-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "對所有戰鬥中單位造成1點傷害。",
    		descriptionRaw: "對所有戰鬥中單位造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「跟我一起跳舞吧。」——卡特蓮娜",
    		artistName: "Rafael Zanchetin",
    		name: "死亡蓮花",
    		cardCode: "01NX050",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T1-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 1,
    		description: "<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。",
    		descriptionRaw: "飛逝。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「今日，我踏上了一趟全新的科學之旅：自動機械裝置！俗話說得好，偉大之人必能成就偉大之事！你問這句話是誰說的？當然是我啊！」——《漢默丁格的實驗室手札》〈引言〉",
    		artistName: "SIXMOREVODKA",
    		name: "Mk0：發條粉碎機",
    		cardCode: "01PZ056T1",
    		keywords: [
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "科技",
    		subtypes: [
    			"科技"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO031.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO031-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 6,
    		health: 5,
    		description: "我方的<link=keyword.Burst><sprite name=Burst><style=Keyword>疾速</style></link>法術魔耗值-1。",
    		descriptionRaw: "我方的疾速法術魔耗值-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "它的歌響徹全村；每道從天上傳至山腰的聲波又長又低沉，宛如午後奇異的雲彩飄忽不定。",
    		artistName: "SIXMOREVODKA",
    		name: "飲雲飛鯨",
    		cardCode: "01IO031",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE003-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 2,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：賦予1個友軍單位+2|+2。",
    		descriptionRaw: "出牌：賦予1個友軍單位+2|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「沒錯，它們確實很美麗。但就像任何精良工器一樣，唯有在大師手中，才能展現真正的美。」 ",
    		artistName: "SIXMOREVODKA",
    		name: "羅倫特家族刀劍收藏家",
    		cardCode: "01DE003",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR023.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR023-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 12,
    		health: 0,
    		description: "現在及每<link=vocab.RoundStart><style=Vocab>回合開始</style></link>時，召喚牌組最上方的友軍單位。",
    		descriptionRaw: "現在及每回合開始時，召喚牌組最上方的友軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "總有一天，一聲無庸置疑的呼喚將響徹弗雷爾卓德，宣告遠古仇敵再次現身。屆時所有人都會挺身回應呼召。",
    		artistName: "SIXMOREVODKA",
    		name: "戰爭之母的呼喚",
    		cardCode: "01FR023",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ033T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ033.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ033-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "若我方在本牌局打出<style=Variable>20</style>張不同名稱的卡牌，則召喚1個<link=card.summon><style=AssociatedCard>貓劫降臨</style></link>。<style=Variable></style>",
    		descriptionRaw: "若我方在本牌局打出20張不同名稱的卡牌，則召喚1個貓劫降臨。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「到頭來，為了馮奕卜的願景而付出努力的所有人都被蒙在鼓裡。我們對後果一無所知，不曉得自己即將釋放多麼恐怖的力量。」——皮爾托福專案工程師",
    		artistName: "Kudos Productions",
    		name: "追尋完喵",
    		cardCode: "01PZ033",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI033"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI033T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI033T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "將敵方主堡生命值砍半，無條件捨去。",
    		descriptionRaw: "將敵方主堡生命值砍半，無條件捨去。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "半刃半人。這把武器連同主人的承諾一起被打破，跟著其誓言守護的國王一起崩毀，伴隨曾受到祝福的暗影王國一起殞落。",
    		artistName: "Kudos Productions",
    		name: "雷卓思之刃",
    		cardCode: "01SI033T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ051.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ051-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 5,
    		health: 3,
    		description: "我方所有法術與<link=keyword.Skill><sprite name=PlaySkillMark><style=Keyword>技能</style></link>額外造成1點傷害。",
    		descriptionRaw: "我方所有法術與技能額外造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「想提高轟炸威力是吧？交給我就對了！」",
    		artistName: "SIXMOREVODKA",
    		name: "武趣工匠",
    		cardCode: "01PZ051",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI028.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI028-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "選擇1個友軍單位，召喚1個與之相同的複製單位，其為<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>且能力值為1|1。",
    		descriptionRaw: "選擇1個友軍單位，召喚1個與之相同的複製單位，其為閃靈且能力值為1|1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我從水裡撈起屍體，想查清這個可憐人的身分。我的手才碰到他的肩膀，他忽然轉過頭來面向我。這個人……是我？」——蒂瑪西亞士兵，阿里．倫斯",
    		artistName: "Max Grecke",
    		name: "裂靈術",
    		cardCode: "01SI028",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI025.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI025-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "擊殺1個友軍單位，並對任一目標造成等同該單位力量值的傷害。",
    		descriptionRaw: "擊殺1個友軍單位，並對任一目標造成等同該單位力量值的傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "對不知死亡為何物之人，殺戮簡直不痛不癢。",
    		artistName: "Kudos Productions",
    		name: "殘酷暴行",
    		cardCode: "01SI025",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO015",
    			"01IO015T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO015T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO015T2-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>1個攻擊中敵軍單位。\r\n將1張<link=card.level1><style=AssociatedCard>犽宿</style></link>洗入我方牌組。",
    		descriptionRaw: "擊暈1個攻擊中敵軍單位。\r\n將1張犽宿洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「尖銳一擊！」——犽宿",
    		artistName: "Max Grecke",
    		name: "犽宿 鋼鐵暴雪",
    		cardCode: "01IO015T2",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO011-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "<link=keyword.Recall><style=Keyword>召回</style></link>1個友軍單位。",
    		descriptionRaw: "召回1個友軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "聰明的戰士不僅僅要知道自己有多少韌性，更要克己。畢竟留得青山在，不怕沒柴燒。",
    		artistName: "Kudos Production",
    		name: "召回",
    		cardCode: "01IO011",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO009T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO009T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "暗影之刃，利如鋼鐵。",
    		artistName: "SIXMOREVODKA",
    		name: "疾風殘影",
    		cardCode: "01IO009T1",
    		keywords: [
    			"閃靈"
    		],
    		keywordRefs: [
    			"Ephemeral"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO002-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "<link=keyword.Recall><style=Keyword>召回</style></link>1個單位。",
    		descriptionRaw: "召回1個單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "入侵者踏入愛歐尼亞的領土，才發現就算征服了居民，也征服不了這片大地。",
    		artistName: "Max Grecke",
    		name: "愛歐尼亞的意志",
    		cardCode: "01IO002",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO007"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO007T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO007T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "若我方場上有1個攻擊中<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>單位，則擊殺<link=card.Kalgren><style=AssociatedCard>暗影之刃．忍</style></link>的格檔者。",
    		descriptionRaw: "若我方場上有1個攻擊中閃靈單位，則擊殺暗影之刃．忍的格檔者。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「黑暗降臨之際，暗影伸長，生命縮短……」",
    		artistName: "Kudos Productions",
    		name: "致命打擊",
    		cardCode: "01IO007T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR047.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR047-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "<link=keyword.Enlightened><style=Keyword>開悟</style></link>：此牌獲得+4|+4。",
    		descriptionRaw: "開悟：此牌獲得+4|+4。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「學會野獸嘶吼的人，很快會忘卻原來的語言。」——艾妮維亞",
    		artistName: "SIXMOREVODKA",
    		name: "野魂秘術師",
    		cardCode: "01FR047",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO033T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO033T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "<link=keyword.Recall><style=Keyword>召回</style></link>3個敵軍單位。",
    		descriptionRaw: "召回3個敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們整個人飛上天，回過神來，我已平躺在地了！」——那歐竊匪",
    		artistName: "Kudos Productions",
    		name: "飛天三連踢",
    		cardCode: "01IO033T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO017-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "召喚此牌時，本回合給予此牌<link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>。",
    		descriptionRaw: "召喚此牌時，本回合給予此牌隱密。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「沒問題，我可以先發制人。只要幫我逃出這個鬼地方，我就跟你對分贓物，保證值回票價！」",
    		artistName: "SIXMOREVODKA",
    		name: "那歐利刃斥侯",
    		cardCode: "01IO017",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR056.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR056-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 5,
    		cost: 7,
    		health: 5,
    		description: "召喚此牌時，<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>所有生命值3點或以下的敵軍單位。",
    		descriptionRaw: "召喚此牌時，凍傷所有生命值3點或以下的敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「啊啊啊啊啊啊啊！」——漫遊者比亞",
    		artistName: "JiHun Lee",
    		name: "寒地雪怪",
    		cardCode: "01FR056",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "雪怪",
    		subtypes: [
    			"雪怪"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX056.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX056-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "對1個敵軍單位造成2點傷害，並進行<link=vocab.Rally><style=Vocab>備戰</style></link>。",
    		descriptionRaw: "對1個敵軍單位造成2點傷害，並進行備戰。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "等到瞧見刀刃，一切為時已晚。",
    		artistName: "Kudos Productions",
    		name: "瞬步",
    		cardCode: "01NX056",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ008"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ022-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對我方主堡造成1點傷害。",
    		descriptionRaw: "對我方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「膨菇爆開，膨菇爆開，\n喔喔喔，喔喔喔！\n膨菇爆開，膨菇爆開，\n把人害，把人害！」——佐恩童謠",
    		artistName: "SIXMOREVODKA",
    		name: "劇毒膨菇",
    		cardCode: "01PZ022",
    		keywords: [
    			"陷阱"
    		],
    		keywordRefs: [
    			"Autoplay"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "陷阱",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ044T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ044T2-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對所有敵軍單位造成1點傷害。",
    		descriptionRaw: "對所有敵軍單位造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「表演開始！」——化學龐克撕裂樂手",
    		artistName: "Max Grecke",
    		name: "魔音穿腦",
    		cardCode: "01PZ044T2",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI046.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI046-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "隨機復甦1個本回合陣亡的友軍單位。",
    		descriptionRaw: "隨機復甦1個本回合陣亡的友軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「那陣黯霧會活生生割除人類的靈魂，留下一具半死不活的軀體。我曾親眼目睹家鄉遭到蹂躪，所以我要前往那些受到詛咒的島嶼，了結這一切。」——無畏守備官，阿里．倫斯",
    		artistName: "Rafael Zanchetin",
    		name: "黯霧呼喚",
    		cardCode: "01SI046",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ033T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ033T1-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 30,
    		cost: 1,
    		health: 30,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "你的喵日將至。",
    		artistName: "SIXMOREVODKA",
    		name: "貓劫降臨",
    		cardCode: "01PZ033T1",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX033.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX033-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 4,
    		cost: 4,
    		health: 3,
    		description: "召喚此牌時，我方場上每有1個力量值5點或以上的友軍，則抽1張牌。",
    		descriptionRaw: "召喚此牌時，我方場上每有1個力量值5點或以上的友軍，則抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「唯有堅決敏銳的眼力才能挑選出夠格加入特菲利安軍團的人才。她呢，她從一哩外就能從羊群中看見一隻狼。」——軍團大將軍",
    		artistName: "SIXMOREVODKA",
    		name: "特菲利安鑑定員",
    		cardCode: "01NX033",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE032.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE032-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予1個友軍單位<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。",
    		descriptionRaw: "本回合給予1個友軍單位光盾。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「當你與眾不同，全世界都會跟你作對。有人說，你的不同之處會成為弱點，其實你只會更加堅強且富有同情心。再黑暗的時刻，都有我保護你！」——拉克絲",
    		artistName: "Kudos Productions",
    		name: "稜光障壁",
    		cardCode: "01DE032",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX006T2",
    			"01NX006",
    			"01NX006T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX006T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX006T1-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 6,
    		cost: 5,
    		health: 6,
    		description: "<link=keyword.AttackSkillMark><sprite name=AttackSkillMark><style=Keyword>攻擊</style></link>：對每個攻擊中友軍單位造成1點傷害，且每傷害1個攻擊中友軍單位，便對敵方主堡造成1點傷害。",
    		descriptionRaw: "攻擊：對每個攻擊中友軍單位造成1點傷害，且每傷害1個攻擊中友軍單位，便對敵方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「",
    		artistName: "SIXMOREVODKA",
    		name: "弗拉迪米爾",
    		cardCode: "01NX006T1",
    		keywords: [
    			"再生"
    		],
    		keywordRefs: [
    			"Regeneration"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ023.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ023-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 4,
    		health: 3,
    		description: "我方召喚魔耗值1的友軍單位時，賦予其+2|+2。",
    		descriptionRaw: "我方召喚魔耗值1的友軍單位時，賦予其+2|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「今天我要為各位委員帶來我的最新發明，在此邀請我令人敬重的夥伴進行示範……」",
    		artistName: "SIXMOREVODKA",
    		name: "馮奕卜教授",
    		cardCode: "01PZ023",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T4.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T4-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。",
    		descriptionRaw: "飛逝。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「前陣子我突然想到，我只有兩隻手，最多只能拿兩把扳手！所以我想了一個解決方案：替自己加裝更多手。啊哈！開玩笑的。答案是扳手機器人！」——《漢默丁格的實驗室手札》第1冊",
    		artistName: "SIXMOREVODKA",
    		name: "Mk1：扳手機器人",
    		cardCode: "01PZ056T4",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "科技",
    		subtypes: [
    			"科技"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR039T2",
    			"01FR039T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR039.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR039-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 8,
    		cost: 8,
    		health: 4,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "此牌將要陣亡時，反而會升級。",
    		levelupDescriptionRaw: "此牌將要陣亡時，反而會升級。",
    		flavorText: "「別為理想殉身，把它活出來。」",
    		artistName: "SIXMOREVODKA",
    		name: "泰達米爾",
    		cardCode: "01FR039",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR027.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR027-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 4,
    		cost: 4,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "艾伐洛森有幾篇「老伯伯厄努克」的民間故事，主角是一頭固執又愛發牢騷的厄努克。他一心只想找一片溫暖的草地，配上一個可以碎碎念的話題。 ",
    		artistName: "SIXMOREVODKA",
    		name: "厄努克公牛",
    		cardCode: "01FR027",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "厄努克",
    		subtypes: [
    			"厄努克"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI050.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI050-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "召喚3個<link=card.summon><style=AssociatedCard>小蜘蛛</style></link>，並賦予蜘蛛友軍單位+1|+0。 ",
    		descriptionRaw: "召喚3個小蜘蛛，並賦予蜘蛛友軍單位+1|+0。 ",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "剛孵化的時候胃口最好。",
    		artistName: "Kudos Productions",
    		name: "傾巢而出",
    		cardCode: "01SI050",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR057.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR057-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "本回合給予所有友軍單位+2|+2與<link=keyword.Overwhelm><sprite name=Overwhelm><style=Keyword>勢不可擋</style></link>。",
    		descriptionRaw: "本回合給予所有友軍單位+2|+2與勢不可擋。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "一聲孤獨的狼嚎在黑夜裡迴盪，嚎叫聲隨後此起彼落。過了一陣子，狼嚎聲合而為一，宛如一首由嗜血的激動叫聲所組成的主旋律。",
    		artistName: "Kudos Productions",
    		name: "獸群心性",
    		cardCode: "01FR057",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ024.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ024-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 4,
    		cost: 5,
    		health: 4,
    		description: "若我方在本牌局已施放1張魔耗值6點或以上的法術牌，則賦予此牌+4|+0與<link=keyword.Quick Strike><sprite name=QuickStrike><style=Keyword>快速攻擊</style></link>。",
    		descriptionRaw: "若我方在本牌局已施放1張魔耗值6點或以上的法術牌，則賦予此牌+4|+0與快速攻擊。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "姓名：科拉斯．漢維克；年齡：51歲；執照類別：第2級（附條件）；狀態：吊銷；備註：無視多次警告，實驗室爆炸（第13X764NM號案件）後仍持續輸出。切勿予以放行許可。",
    		artistName: "SIXMOREVODKA",
    		name: "暴走配線員",
    		cardCode: "01PZ024",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI014"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI016-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Allegiance><style=Vocab>效忠</style></link>：召喚1個<link=card.create><style=AssociatedCard>霧魅</style></link>。",
    		descriptionRaw: "效忠：召喚1個霧魅。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "她總是無聲無息地現身，但她身後那群駭人的傢伙就沒這麼安靜了。",
    		artistName: "SIXMOREVODKA",
    		name: "使魅師",
    		cardCode: "01SI016",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO042.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO042-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "召喚1個友軍單位時，本回合給予此牌+1|+1。",
    		descriptionRaw: "召喚1個友軍單位時，本回合給予此牌+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「要是沒人看見你的英勇招式，那戰鬥還有什麼意義呢？」",
    		artistName: "SIXMOREVODKA",
    		name: "武術學徒",
    		cardCode: "01IO042",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR038",
    			"01FR038T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR038T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR038T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>1個敵軍單位。\r\n將1張<link=card.level1><style=AssociatedCard>艾希</style></link>洗入我方牌組。",
    		descriptionRaw: "凍傷1個敵軍單位。\r\n將1張艾希洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "寒冷無預警襲擊，即使再強的戰士都感到無助。",
    		artistName: "SIXMOREVODKA",
    		name: "艾希 急速冰凍",
    		cardCode: "01FR038T1",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR021T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR021.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR021-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 5,
    		cost: 5,
    		health: 8,
    		description: "<link=keyword.AttackSkillMark><sprite name=AttackSkillMark><style=Keyword>攻擊</style></link>：對所有戰鬥中單位造成1點傷害。",
    		descriptionRaw: "攻擊：對所有戰鬥中單位造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「塔卡茲打起仗比多數人更奮力勇猛，遇到挫敗也能很有風度地接受。至少多數時候是這樣……」——泰達米爾",
    		artistName: "SIXMOREVODKA",
    		name: "獨行狂戰塔卡茲",
    		cardCode: "01FR021",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO006-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 2,
    		health: 1,
    		description: "每召喚1個友軍單位，本回合給予此牌+1|+0。",
    		descriptionRaw: "每召喚1個友軍單位，本回合給予此牌+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「嘿，注意那些樹枝！左邊，小心左邊！」\n「毛球，哪一天換我坐在你肩上，去那裡都聽你的。但在那之前，就交給我吧！」",
    		artistName: "SIXMOREVODKA",
    		name: "林地雙煞",
    		cardCode: "01IO006",
    		keywords: [
    			"隱密"
    		],
    		keywordRefs: [
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX052.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX052-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "對1個友軍侍從單位造成1點傷害。若其存活，則在手牌生成一張該單位的複製牌。",
    		descriptionRaw: "對1個友軍侍從單位造成1點傷害。若其存活，則在手牌生成一張該單位的複製牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "血之魔法術士的第一堂課總是搞得四處血瀝瀝。",
    		artistName: "Kudos Productions",
    		name: "血債血還",
    		cardCode: "01NX052",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO050.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO050-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Allegiance><style=Vocab>效忠</style></link>：從牌組召喚2個魔耗值1的友軍單位。",
    		descriptionRaw: "效忠：從牌組召喚2個魔耗值1的友軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "無論她去到何處，總會確保其他人也能跟上。",
    		artistName: "SIXMOREVODKA",
    		name: "均衡引路人",
    		cardCode: "01IO050",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE026.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE026-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "使1個友軍單位與1個敵軍單位互相<link=vocab.Strike><style=Vocab>打擊</style></link>。",
    		descriptionRaw: "使1個友軍單位與1個敵軍單位互相打擊。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「多說無益；我們用劍刃溝通。」——菲歐拉",
    		artistName: "Kudos Productions",
    		name: "單挑",
    		cardCode: "01DE026",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX043",
    			"01NX042T2",
    			"01NX042T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX042.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX042-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：在手牌生成1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.create><style=AssociatedCard>利刃刀鋒</style></link>。",
    		descriptionRaw: "出牌：在手牌生成1張飛逝利刃刀鋒。",
    		levelupDescription: "此牌<link=vocab.Strike><style=Vocab>打擊</style></link>1次。此牌升級時會被<link=keyword.Recall><style=Keyword>召回</style></link>。",
    		levelupDescriptionRaw: "此牌打擊1次。此牌升級時會被召回。",
    		flavorText: "「要練手感，沒有什麼比蒂瑪西亞活標靶還來得適合...」",
    		artistName: "SIXMOREVODKA",
    		name: "卡特蓮娜",
    		cardCode: "01NX042",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI021.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI021-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 3,
    		cost: 2,
    		health: 1,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：下次有<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>友軍單位攻擊時，此牌將復甦並攻擊。",
    		descriptionRaw: "遺願：下次有閃靈友軍單位攻擊時，此牌將復甦並攻擊。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你說她看見了什麼？這樣我瞭解了。我說藥師啊，心智發狂既殘酷又容易令人深陷其中。至少其他人的說法不像她這麼荒謬。」——蒂瑪西亞醫生",
    		artistName: "SIXMOREVODKA",
    		name: "鯊魚戰車",
    		cardCode: "01SI021",
    		keywords: [
    			"無法進行格檔",
    			"閃靈",
    			"遺願"
    		],
    		keywordRefs: [
    			"CantBlock",
    			"Ephemeral",
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR028"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR048.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR048-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "召喚此牌時，生成1張<link=card.create><style=AssociatedCard>暴怒雪怪</style></link>放入牌組的前3張牌。",
    		descriptionRaw: "召喚此牌時，生成1張暴怒雪怪放入牌組的前3張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「整整一個禮拜都沒抓到半隻！不是牠們看穿我的陷阱，就是有東西把牠們嚇跑了……」",
    		artistName: "SIXMOREVODKA",
    		name: "艾伐洛森捕獸人",
    		cardCode: "01FR048",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ049.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ049-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "抽3張牌，使其魔耗值各-1。",
    		descriptionRaw: "抽3張牌，使其魔耗值各-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "進步日！\n一起來太陽門廣場！\n見證海克斯科技奇蹟！\n令人大開眼界的大膽普羅！\n聆聽洞悉明日之人暢談今日局面\n免費入場！\n歡迎皮爾托福的孩子共襄盛舉！",
    		artistName: "Kudos Productions",
    		name: "進步日！",
    		cardCode: "01PZ049",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO048.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO048-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 5,
    		health: 3,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「劫大師，您的軍團將我們驅離家園，證明了您的力量。現在就讓我證明自己也有足以貫徹您教誨的實力。」",
    		artistName: "SIXMOREVODKA",
    		name: "遊剎裏",
    		cardCode: "01IO048",
    		keywords: [
    			"挑戰者",
    			"隱密"
    		],
    		keywordRefs: [
    			"Challenger",
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR017-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 5,
    		health: 3,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：從我方牌組前6張牌召喚所有厄努克，將其餘卡牌洗入我方牌組。",
    		descriptionRaw: "出牌：從我方牌組前6張牌召喚所有厄努克，將其餘卡牌洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「艾伐洛森人就像雙眼無神的草食厄努克牛群，連無痕者都能輕易撂倒。他們靠著人多勢眾才得以存活。」——戰痕之母芙蕊娜",
    		artistName: "SIXMOREVODKA",
    		name: "厄努克牛群",
    		cardCode: "01FR017",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "厄努克",
    		subtypes: [
    			"厄努克"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO004-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "治癒1個友軍單位或我方主堡3點生命",
    		descriptionRaw: "治癒1個友軍單位或我方主堡3點生命",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "雖然每個世代、區域和家族都有各自的獨家秘方，但有些配方的確效果更為出眾。",
    		artistName: "Kudos Productions",
    		name: "生命藥水",
    		cardCode: "01IO004",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI032.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI032-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：擊殺1個友軍單位，再將其復甦。",
    		descriptionRaw: "出牌：擊殺1個友軍單位，再將其復甦。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "很久以前，她曾坐在父親身邊，看他翻閱布滿灰塵的書卷。父親希望她將來能繼承藏品專家的衣缽，但萬萬沒想到會是這種形式。",
    		artistName: "SIXMOREVODKA",
    		name: "殞落王國編年史家",
    		cardCode: "01SI032",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ006-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 6,
    		cost: 10,
    		health: 6,
    		description: "本牌局我方每施放1張法術，則此牌魔耗值-1。",
    		descriptionRaw: "本牌局我方每施放1張法術，則此牌魔耗值-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "給你二十秒乖乖就範。",
    		artistName: "SIXMOREVODKA",
    		name: "廣場守護者",
    		cardCode: "01PZ006",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO007-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 6,
    		cost: 8,
    		health: 4,
    		description: "敵方召喚侍從單位時，賦予其<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。",
    		descriptionRaw: "敵方召喚侍從單位時，賦予其閃靈。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「儘量逃跑、奮戰、畏縮吧。那都不重要，暗影已來到你身旁。」",
    		artistName: "SIXMOREVODKA",
    		name: "暗影之刃．忍",
    		cardCode: "01IO007",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR024T5",
    			"01FR024",
    			"01FR024T1",
    			"01FR024T4"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR024T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR024T3-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 7,
    		health: 5,
    		description: "<link=keyword.AttackSkillMark><sprite name=AttackSkillMark><style=Keyword>攻擊</style></link>：對所有敵軍單位與敵方主堡造成2點傷害。\r\n<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：復甦此牌並幻化為<link=card.transform><style=AssociatedCard>蛋妮維亞</style></link>。",
    		descriptionRaw: "攻擊：對所有敵軍單位與敵方主堡造成2點傷害。\r\n遺願：復甦此牌並幻化為蛋妮維亞。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「行軍到此為止，調回你的軍隊，冬之眼已經察覺這場征戰，其凜冽的利爪將緊緊攫住你反叛的心。」 ",
    		artistName: "SIXMOREVODKA",
    		name: "艾妮維亞",
    		cardCode: "01FR024T3",
    		keywords: [
    			"遺願"
    		],
    		keywordRefs: [
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI058.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI058-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 5,
    		health: 3,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：擊殺1個友軍單位，從任一區域隨機召喚1個魔耗值2+的侍從單位。",
    		descriptionRaw: "出牌：擊殺1個友軍單位，從任一區域隨機召喚1個魔耗值2+的侍從單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "怨靈們，把聲音借給我！我們將協力召出無盡的黑暗！",
    		artistName: "JiHun Lee",
    		name: "幻影赦魔",
    		cardCode: "01SI058",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ010",
    			"01PZ022"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ053.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ053-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，在手牌生成1張<link=card.create><style=AssociatedCard>蘑菇雲</style></link>。",
    		descriptionRaw: "召喚此牌時，在手牌生成1張蘑菇雲。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「嗯，沒錯！有一大團，鬼鬼祟祟！他們看起來好像瘋了，但你不懂。我才懂！他們要幹一票大的！一票大的。膨菇、起司、雪酪……我說到哪了？」——膨菇小販",
    		artistName: "SIXMOREVODKA",
    		name: "呼碰引伴",
    		cardCode: "01PZ053",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO053.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO053-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 3,
    		health: 2,
    		description: "<link=keyword.Enlightened><style=Keyword>開悟</style></link>：此牌獲得+4|+4。",
    		descriptionRaw: "開悟：此牌獲得+4|+4。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「征戰是人類的本能，但是本能無法凌駕我們的高尚美德，比如：信任、耐心與沉思。」",
    		artistName: "SIXMOREVODKA",
    		name: "翡翠覺醒者",
    		cardCode: "01IO053",
    		keywords: [
    			"吸血"
    		],
    		keywordRefs: [
    			"Lifesteal"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR046.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR046-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "賦予1個負傷友軍單位+3|+3。",
    		descriptionRaw: "賦予1個負傷友軍單位+3|+3。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「……布郎姆的傷勢頗為嚴重，他卻仰天大笑。因為他知道最艱困危急的時刻，正是英雄誕生之際！」——《布郎姆傳說》",
    		artistName: "SIXMOREVODKA",
    		name: "精神抖擻",
    		cardCode: "01FR046",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX045.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX045-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 7,
    		cost: 7,
    		health: 4,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「下一位，巨爪！上次他把瘋魔五人組痛扁一頓……現在變三人組了。好啦！押注打賭誰是今天的輸家！賠率四比一！」——競技場組頭卡爾",
    		artistName: "SIXMOREVODKA",
    		name: "野蠻角鬥士",
    		cardCode: "01NX045",
    		keywords: [
    			"勢不可擋",
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Overwhelm",
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE027.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE027-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予所有友軍單位<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。",
    		descriptionRaw: "本回合給予所有友軍單位挑戰者。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「沒有一名蒂瑪西亞人會拒絕羅倫特的劍術課程，但是也沒有人能撐完整堂課。」——菲歐拉",
    		artistName: "Kudos Productions",
    		name: "預備擊劍",
    		cardCode: "01DE027",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI044.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI044-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 6,
    		cost: 8,
    		health: 6,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：選擇1個友軍單位，召喚1個與之相同的複製單位，其為<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。",
    		descriptionRaw: "出牌：選擇1個友軍單位，召喚1個與之相同的複製單位，其為閃靈。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "殞落王者的詛咒所到之處，無一倖免。仁慈之人變得殘忍；勇敢之人變得野蠻；怨恨蒙蔽了理智。",
    		artistName: "SIXMOREVODKA",
    		name: "幽魂女戒護官",
    		cardCode: "01SI044",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR040.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR040-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 5,
    		health: 3,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link><link=vocab.Strongest><style=Vocab>最強</style></link>敵軍單位。",
    		descriptionRaw: "回合開始：凍傷最強敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「要與野外共存就不該逃避冰天雪地，應當在荒涼中陶醉狂歡。」",
    		artistName: "SIXMOREVODKA",
    		name: "冰霜獠牙薩滿",
    		cardCode: "01FR040",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO049.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO049-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "抵銷一個<link=keyword.Fast><sprite name=Fast><style=Keyword>快速</style></link>法術、<link=keyword.Slow><sprite name=Slow><style=Keyword>慢速</style></link>法術或<link=keyword.Skill><sprite name=PlaySkillMark><style=Keyword>技能</style></link>。",
    		descriptionRaw: "抵銷一個快速法術、慢速法術或技能。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "休想。",
    		artistName: "Kudos Productions",
    		name: "抵制",
    		cardCode: "01IO049",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX031.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX031-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 5,
    		cost: 2,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "大多人在特菲利安軍團挣得一席便已滿足，但少數人則否。",
    		artistName: "SIXMOREVODKA",
    		name: "特菲利安求譽者",
    		cardCode: "01NX031",
    		keywords: [
    			"挑戰者",
    			"無法進行格檔"
    		],
    		keywordRefs: [
    			"Challenger",
    			"CantBlock"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ012-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 2,
    		health: 2,
    		description: "若此牌遭到棄置，則反而會被召喚。",
    		descriptionRaw: "若此牌遭到棄置，則反而會被召喚。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「上吧，咬咬！」——吉茵珂絲",
    		artistName: "SIXMOREVODKA",
    		name: "咬咬手榴彈！",
    		cardCode: "01PZ012",
    		keywords: [
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR031.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR031-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 5,
    		cost: 7,
    		health: 5,
    		description: "<link=vocab.RoundEnd><style=Vocab>回合結束</style></link>：若此牌在手牌中，則魔耗值-1。",
    		descriptionRaw: "回合結束：若此牌在手牌中，則魔耗值-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「那是怎麼回事？聽起來像是打噴嚏。冰川會……打噴嚏嗎？」——漫遊者比亞\n",
    		artistName: "SIXMOREVODKA",
    		name: "遠古雪怪",
    		cardCode: "01FR031",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "雪怪",
    		subtypes: [
    			"雪怪"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE035"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE006-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "召喚此牌時，在手牌生成1張<link=card.create><style=AssociatedCard>蒂瑪西亞萬歲！</style></link>。",
    		descriptionRaw: "召喚此牌時，在手牌生成1張蒂瑪西亞萬歲！。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「他日夜帶領我們訓練，激戰時身先士卒。宛如鋼鐵般堅硬、也像磐石般穩重。領袖人選非他莫屬。」——蒂瑪西亞少尉",
    		artistName: "SIXMOREVODKA",
    		name: "先鋒中士",
    		cardCode: "01DE006",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "菁英",
    		subtypes: [
    			"菁英"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR036T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR036T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對1個敵軍單位造成1點傷害。",
    		descriptionRaw: "對1個敵軍單位造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "逮到你囉。",
    		artistName: "Max Grecke",
    		name: "正中紅心",
    		cardCode: "01FR036T1",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR053.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR053-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「這位長角力士為了保護普羅王，不顧一切擊退一隻發瘋的狂爪狼，結果失去了一隻眼睛！這告訴我們，戰槌再無堅不摧，也需要強大的心靈才能奮力揮舞。」——普羅牧人\n",
    		artistName: "SIXMOREVODKA",
    		name: "大力普羅",
    		cardCode: "01FR053",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "普羅",
    		subtypes: [
    			"普羅"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO052T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO052T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 2,
    		health: 2,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "如果在路上發現一名土匪，草叢中肯定有更多同夥。",
    		artistName: "SIXMOREVODKA",
    		name: "那歐竊匪",
    		cardCode: "01IO052T1",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI039.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI039-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "有些心懷惡意的怨靈從當地動物獲得靈感，常見的生物幻化為惡夢般的存在。",
    		artistName: "SIXMOREVODKA",
    		name: "八爪夢魘",
    		cardCode: "01SI039",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "蜘蛛",
    		subtypes: [
    			"蜘蛛"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ039.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ039-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "棄置1張牌即可出此牌。\r\n對任一目標造成3點傷害。",
    		descriptionRaw: "棄置1張牌即可出此牌。\r\n對任一目標造成3點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「大火力登場！」——吉茵珂絲",
    		artistName: "Original Force",
    		name: "狂躁！",
    		cardCode: "01PZ039",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T9.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T9-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 6,
    		cost: 6,
    		health: 1,
    		description: "<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。",
    		descriptionRaw: "飛逝。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「又是科學的一大進步！我的投球機終於成功與海克斯能源動力結合啦！容我為各位介紹，風暴吊球機！好，該睡了。」——《漢默丁格的實驗室手札》第6冊",
    		artistName: "SIXMOREVODKA",
    		name: "Mk6：風暴吊球機",
    		cardCode: "01PZ056T9",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "科技",
    		subtypes: [
    			"科技"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE022"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE038.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE038-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 3,
    		health: 2,
    		description: "此牌在場上時，若友軍<link=card.luc1><style=AssociatedCard>路西恩</style></link>陣亡，則賦予此牌+1|+1與<link=keyword.Double Strike><sprite name=DoubleStrike><style=Keyword>雙重攻擊</style></link>，僅限發動一次。",
    		descriptionRaw: "此牌在場上時，若友軍路西恩陣亡，則賦予此牌+1|+1與雙重攻擊，僅限發動一次。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們的哨兵是抵禦永無安寧的亡靈、守護人類王國的第一道防線。我們先發制人、猛力進攻，同伴命懸一線時更是絕不退縮。」",
    		artistName: "SIXMOREVODKA",
    		name: "光之哨兵姍娜",
    		cardCode: "01DE038",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR010-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "賦予2個友軍單位+0|+3。",
    		descriptionRaw: "賦予2個友軍單位+0|+3。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我會成為妳內心的火把、隨侍妳身旁的盾牌。我將竭力保護部族，以血誓之盟為證，願我倆的命運從此合一。」——泰達米爾",
    		artistName: "SIXMOREVODKA",
    		name: "血誓之盟",
    		cardCode: "01FR010",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO052T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO052.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO052-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，召喚1個與此牌能力值相同的<link=card.summon><style=AssociatedCard>那歐竊匪</style></link>。",
    		descriptionRaw: "召喚此牌時，召喚1個與此牌能力值相同的那歐竊匪。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「諾克薩斯入侵之前，我曾是名四處旅行的音樂家，名聲從每個村莊遠播至平典城。如今我只能靠搶來的金幣苟延殘喘。母親說得對，我應該當一名治療師的……」",
    		artistName: "SIXMOREVODKA",
    		name: "那歐劫匪",
    		cardCode: "01IO052",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO030.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO030-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 6,
    		cost: 7,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「天上雲層纏繞，強風吹倒我們的軍旅。我們試著尾隨其後，但誰能真的追到風呢？」——軍團將軍",
    		artistName: "SIXMOREVODKA",
    		name: "蒼天龍",
    		cardCode: "01IO030",
    		keywords: [
    			"隱密"
    		],
    		keywordRefs: [
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE041.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE041-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "本回合給予2個友軍單位+3|+3。",
    		descriptionRaw: "本回合給予2個友軍單位+3|+3。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「掩護我，我要闖進去了！」\n「哈，我剛剛正想對你說一樣的話。」\n——東營區的隆和達克斯",
    		artistName: "Kudos Productions",
    		name: "互相照應",
    		cardCode: "01DE041",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX006T2",
    			"01NX006T1",
    			"01NX006T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX006-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 5,
    		cost: 5,
    		health: 5,
    		description: "<link=keyword.AttackSkillMark><sprite name=AttackSkillMark><style=Keyword>攻擊</style></link>：對每個攻擊中友軍單位造成1點傷害，且每傷害1個攻擊中友軍單位，便對敵方主堡造成1點傷害。",
    		descriptionRaw: "攻擊：對每個攻擊中友軍單位造成1點傷害，且每傷害1個攻擊中友軍單位，便對敵方主堡造成1點傷害。",
    		levelupDescription: "6個或以上友軍單位承受傷害且未陣亡<style=Variable></style>。",
    		levelupDescriptionRaw: "6個或以上友軍單位承受傷害且未陣亡。",
    		flavorText: "邪惡，冷漠，殘酷，迷人，敏銳，魅力十足。\n令人難以抗拒……",
    		artistName: "SIXMOREVODKA",
    		name: "弗拉迪米爾",
    		cardCode: "01NX006",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ016-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "在手牌隨機生成1張魔耗值6點或以上的法術牌。\r\n同時恢復我方的法術魔力。",
    		descriptionRaw: "在手牌隨機生成1張魔耗值6點或以上的法術牌。\r\n同時恢復我方的法術魔力。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "只消一次頓悟，便可造就一生傳奇。",
    		artistName: "Kudos Productions",
    		name: "靈光電火球",
    		cardCode: "01PZ016",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ036",
    			"01PZ036T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ036T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ036T2-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "對任一目標造成2點傷害。\r\n將1張<link=card.level1><style=AssociatedCard>伊澤瑞爾</style></link>洗入我方牌組。",
    		descriptionRaw: "對任一目標造成2點傷害。\r\n將1張伊澤瑞爾洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我從不失手。但大家都知道我會先射兩發，以示警戒……」——伊澤瑞爾",
    		artistName: "Max Grecke",
    		name: "伊澤瑞爾 秘術射擊",
    		cardCode: "01PZ036T2",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE035.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE035-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "本回合給予友軍單位+3|+3。",
    		descriptionRaw: "本回合給予友軍單位+3|+3。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「它代表了我們的家園、家人，還有披甲上陣的同袍。它也是我們的驕傲、榮譽與力量。就在今日，在我們挺身奮戰的存亡之際，讓我們大力呼喊其名：蒂瑪西亞！」",
    		artistName: "Original Force",
    		name: "蒂瑪西亞萬歲！",
    		cardCode: "01DE035",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX008-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 5,
    		cost: 4,
    		health: 2,
    		description: "<link=vocab.Allegiance><style=Vocab>效忠</style></link>：賦予此牌+1|+1及<link=keyword.Overwhelm><sprite name=Overwhelm><style=Keyword>勢不可擋</style></link>。",
    		descriptionRaw: "效忠：賦予此牌+1|+1及勢不可擋。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "這個特殊的兵種確實需要馬，不過不是拿來騎；他們的座下怪獸覺得馬吃起來是人間美味。",
    		artistName: "SIXMOREVODKA",
    		name: "巨異蜥騎兵",
    		cardCode: "01NX008",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO019-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 1,
    		health: 2,
    		description: "有友軍單位獲得<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>時，賦予此牌+2|+0。",
    		descriptionRaw: "有友軍單位獲得光盾時，賦予此牌+2|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「林地會保護自己人。而你……你是個外人……」",
    		artistName: "SIXMOREVODKA",
    		name: "林地精靈",
    		cardCode: "01IO019",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE018-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "本回合給予1個友軍單位+1|+1。",
    		descriptionRaw: "本回合給予1個友軍單位+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「亡靈打起仗總是不顧一切，彷彿沒有明天。我們就讓它們如願死在今天。」——路西恩\n\n",
    		artistName: "Kudos Productions",
    		name: "光輝打擊",
    		cardCode: "01DE018",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO054.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO054-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "在手牌隨機生成1張其它法術。\r\n<link=keyword.Enlightened><style=Keyword>開悟</style></link>：改為生成2張。",
    		descriptionRaw: "在手牌隨機生成1張其它法術。\r\n開悟：改為生成2張。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「希望渺茫時，記得你不是孤身一人。過往一直與我們同在，無數個明天將帶來希望。」——卡瑪",
    		artistName: "Kudos Productions",
    		name: "亙古洞悉",
    		cardCode: "01IO054",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI020-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 7,
    		health: 4,
    		description: "召喚此牌時，復甦<link=vocab.Strongest><style=Vocab>最強</style></link>的已陣亡友軍英雄。",
    		descriptionRaw: "召喚此牌時，復甦最強的已陣亡友軍英雄。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "一根即將熄滅的蠟燭，除了點燃下一根新蠟燭，還能有什麼作用？",
    		artistName: "SIXMOREVODKA",
    		name: "燃魂人",
    		cardCode: "01SI020",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR001-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>1個敵軍單位。",
    		descriptionRaw: "凍傷1個敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "寒冷無預警襲擊，即使再強的戰士都感到無助。",
    		artistName: "SIXMOREVODKA",
    		name: "急速冰凍",
    		cardCode: "01FR001",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ010",
    			"01PZ022"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ058.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ058-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 4,
    		cost: 4,
    		health: 3,
    		description: "召喚此牌時，在手牌生成2張<link=card.create><style=AssociatedCard>蘑菇雲</style></link>。",
    		descriptionRaw: "召喚此牌時，在手牌生成2張蘑菇雲。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我看過一個大傢伙，真的！她跟一匹馬一樣重，跟石怪一樣詭計多端。我告訴你，你一定要仔細注意這傢伙。她可不是平白無故坐上呼碰女王的寶座！」——膨菇小販",
    		artistName: "SIXMOREVODKA",
    		name: "重量級呼碰",
    		cardCode: "01PZ058",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI042T1",
    			"01SI042T2",
    			"01SI024"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI042.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI042-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 6,
    		health: 5,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：召喚2個攻擊中的<link=card.summon><style=AssociatedCard>幽魂騎士</style></link>。",
    		descriptionRaw: "攻擊：召喚2個攻擊中的幽魂騎士。",
    		levelupDescription: "我方以7+名<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>友軍攻擊<style=Variable></style>。",
    		levelupDescriptionRaw: "我方以7+名閃靈友軍攻擊。",
    		flavorText: "那不是雷電，是戰爭之影要現身了。",
    		artistName: "SIXMOREVODKA",
    		name: "赫克林",
    		cardCode: "01SI042",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE009-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：本回合給予1個友軍單位<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。",
    		descriptionRaw: "出牌：本回合給予1個友軍單位光盾。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我國之所以強盛繁榮，是因為每位戰士的性命就如同一枚錢幣，我們絕不浪擲。」——嘉文三世國王",
    		artistName: "SIXMOREVODKA",
    		name: "閃鋼捍衛者",
    		cardCode: "01DE009",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI029.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI029-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "對所有敵軍單位造成1點傷害。治癒主堡3點生命。",
    		descriptionRaw: "對所有敵軍單位造成1點傷害。治癒主堡3點生命。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "我們每每被擊殺都將使他們更加強大。",
    		artistName: "Kudos Productions",
    		name: "吸星鬼哭",
    		cardCode: "01SI029",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ009-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 3,
    		health: 3,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「個人飛行機械？簡直在作白日夢！我才吩咐徒弟把最新的原型扔掉而已。話說，她人跑去哪了？」——皮爾托福工程師",
    		artistName: "SIXMOREVODKA",
    		name: "懸浮飛板初學者",
    		cardCode: "01PZ009",
    		keywords: [
    			"隱密"
    		],
    		keywordRefs: [
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO032",
    			"01IO032T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO032T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO032T2-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "調換2個友軍單位位置，並在本回合給予其<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。\r\n將1張<link=card.level1><style=AssociatedCard>慎</style></link>洗入我方牌組。",
    		descriptionRaw: "調換2個友軍單位位置，並在本回合給予其光盾。\r\n將1張慎洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我會跟隨均衡的步伐前行。」——慎\n",
    		artistName: "SIXMOREVODKA",
    		name: "慎 並肩作戰",
    		cardCode: "01IO032T2",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI035T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI035.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI035-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 7,
    		cost: 8,
    		health: 5,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：若本回合有友軍陣亡，則擊殺2個<link=keyword.Weakest><style=Keyword>最弱</style></link>敵軍單位。",
    		descriptionRaw: "出牌：若本回合有友軍陣亡，則擊殺2個最弱敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「他們說……他們稱之為傳奇旅程。我們的任務是保衛……蒂瑪西亞的未來。我們懷抱著希望航行，但是……犧牲這麼多人……究竟為了什麼？」——蒂瑪西亞士兵，阿里．倫斯",
    		artistName: "SIXMOREVODKA",
    		name: "割魂手喇煞",
    		cardCode: "01SI035",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR024T2",
    			"01FR024T3",
    			"01FR024T1",
    			"01FR024T4"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR024.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR024-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 2,
    		cost: 7,
    		health: 4,
    		description: "<link=keyword.AttackSkillMark><sprite name=AttackSkillMark><style=Keyword>攻擊</style></link>：對所有敵軍單位與敵方主堡造成1點傷害。\r\n<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：復甦此牌並幻化為<link=card.transform><style=AssociatedCard>蛋妮維亞</style></link>。",
    		descriptionRaw: "攻擊：對所有敵軍單位與敵方主堡造成1點傷害。\r\n遺願：復甦此牌並幻化為蛋妮維亞。",
    		levelupDescription: "我方進入<link=keyword.Enlightened><style=Keyword>開悟</style></link>狀態。",
    		levelupDescriptionRaw: "我方進入開悟狀態。",
    		flavorText: "「我在這片貧瘠大地誕生，我有責任守護這塊疆土。時間、戰爭，甚至是死亡都無法逼我放下戒備。」",
    		artistName: "SIXMOREVODKA",
    		name: "艾妮維亞",
    		cardCode: "01FR024",
    		keywords: [
    			"遺願"
    		],
    		keywordRefs: [
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX034.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX034-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「諾克薩斯容不下……容不下弱——誰來把這隻煩人的傢伙帶走？！」——達瑞斯",
    		artistName: "SIXMOREVODKA",
    		name: "黏人普羅",
    		cardCode: "01NX034",
    		keywords: [
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "普羅",
    		subtypes: [
    			"普羅"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ042.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ042-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 2,
    		health: 3,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：本回合給予此牌支援的友軍單位<link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>。",
    		descriptionRaw: "支援：本回合給予此牌支援的友軍單位隱密。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "許多皮爾托福人透過科學和創新，在進步之城內安全地探索未知的領域。但仍有少數人航向地平線，發掘更廣闊的未知領域：全世界。",
    		artistName: "SIXMOREVODKA",
    		name: "英勇水手",
    		cardCode: "01PZ042",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE042T2",
    			"01DE042T1",
    			"01DE042T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE042.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE042-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 6,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "此牌在場上時我方消耗6點或更多魔力施放法術<style=Variable></style>。升級時在手牌生成一張<link=card.warcry><style=AssociatedCard>終極閃光</style></link>。",
    		levelupDescriptionRaw: "此牌在場上時我方消耗6點或更多魔力施放法術。升級時在手牌生成一張終極閃光。",
    		flavorText: "「我一直都知道自己很特別……體內蘊藏著光芒。我還不了解那究竟是什麼，但我必須搞清楚！」 ",
    		artistName: "SIXMOREVODKA",
    		name: "拉克絲",
    		cardCode: "01DE042",
    		keywords: [
    			"光盾"
    		],
    		keywordRefs: [
    			"Barrier"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE045",
    			"01DE045T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE045T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE045T2-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "本回合給予1個友軍單位+3|+0與<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。\r\n將1張<link=card.level1><style=AssociatedCard>菲歐拉</style></link>洗入我方牌組。",
    		descriptionRaw: "本回合給予1個友軍單位+3|+0與光盾。\r\n將1張菲歐拉洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「『你打起架就像一隻普羅』，這形容真是再貼切不過了！」——菲歐拉",
    		artistName: "Kudos Productions",
    		name: "菲歐拉 斗轉之力",
    		cardCode: "01DE045T2",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX020"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX035.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX035-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "召喚此牌時，若<link=card.dravenRef><style=AssociatedCard>達瑞文</style></link>不在我方場上或手牌中，則將他移至牌組最上方。",
    		descriptionRaw: "召喚此牌時，若達瑞文不在我方場上或手牌中，則將他移至牌組最上方。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「想要親筆簽名？去……去排隊啦，老兄！」",
    		artistName: "SIXMOREVODKA",
    		name: "達瑞文的頭號粉絲",
    		cardCode: "01NX035",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR024",
    			"01FR024T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR024T5.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR024T5-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對所有敵軍單位和敵方主堡造成2點傷害。",
    		descriptionRaw: "對所有敵軍單位和敵方主堡造成2點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "寧靜前的暴風雨。",
    		artistName: "SIXMOREVODKA",
    		name: "冰川風暴",
    		cardCode: "01FR024T5",
    		keywords: [
    			"技能"
    		],
    		keywordRefs: [
    			"Skill"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX026.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX026-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 5,
    		cost: 3,
    		health: 4,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「魯莽是個缺陷，但是經歷過軍團的鍛鍊，魯莽也可以是傷人的利器。」——傑利科．斯溫",
    		artistName: "SIXMOREVODKA",
    		name: "特菲利安莽夫",
    		cardCode: "01NX026",
    		keywords: [
    			"無法進行格檔"
    		],
    		keywordRefs: [
    			"CantBlock"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI004-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 5,
    		cost: 3,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "有些人曾試著潛入潮水，避開殞落王者的詛咒，他們以為詛咒透不進海水深處。他們錯了。",
    		artistName: "SIXMOREVODKA",
    		name: "黑潮災厄",
    		cardCode: "01SI004",
    		keywords: [
    			"閃靈",
    			"吸血"
    		],
    		keywordRefs: [
    			"Ephemeral",
    			"Lifesteal"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO046.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO046-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>1個攻擊中敵軍單位。",
    		descriptionRaw: "擊暈1個攻擊中敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「粉碎！」——犽宿",
    		artistName: "Max Grecke",
    		name: "鋼鐵暴雪",
    		cardCode: "01IO046",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE039.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE039-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 2,
    		cost: 1,
    		health: 2,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「每晚上床睡覺前，母親會一邊述說蒂瑪西亞偉大英雄的故事，一邊磨利手中的劍。我的夢裡總是充滿著冒險。就在今天，我將開始撰寫屬於我自己的故事。」",
    		artistName: "SIXMOREVODKA",
    		name: "克勞菲爾德的希莉亞",
    		cardCode: "01DE039",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "菁英",
    		subtypes: [
    			"菁英"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX006",
    			"01NX006T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX006T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX006T3-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "對1個友軍單位造成1點傷害，本回合給予另一個友軍單位+2|+2。\r\n將1張<link=card.level1><style=AssociatedCard>弗拉迪米爾</style></link>洗入牌組。",
    		descriptionRaw: "對1個友軍單位造成1點傷害，本回合給予另一個友軍單位+2|+2。\r\n將1張弗拉迪米爾洗入牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「親愛的，有得就有失。我得，你失。」——弗拉迪米爾",
    		artistName: "SIXMOREVODKA",
    		name: "弗拉迪米爾 鮮血轉換",
    		cardCode: "01NX006T3",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR043"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR043T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR043T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 4,
    		cost: 6,
    		health: 4,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：召喚1個<link=card.summon><style=AssociatedCard>毛茸茸之心</style></link>。",
    		descriptionRaw: "遺願：召喚1個毛茸茸之心。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「…‥一開始她不知道這些小東西有何能耐。後來一隻隻前仆後繼出現，直到整個大廳都被牠們塞滿！所有普羅齊聚——」\n「該睡了！你們兩個要是沒在五分鐘內睡著的話——！」",
    		artistName: "SIXMOREVODKA",
    		name: "普羅成群",
    		cardCode: "01FR043T1",
    		keywords: [
    			"遺願"
    		],
    		keywordRefs: [
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "普羅",
    		subtypes: [
    			"普羅"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE029.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE029-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "我方召喚另名友軍時，賦予此牌<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。",
    		descriptionRaw: "我方召喚另名友軍時，賦予此牌挑戰者。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "這種猛禽是銀翼鷲的近親，同樣具有獵食本能，但牠們還不太能適應自己小一號的體型。",
    		artistName: "SIXMOREVODKA",
    		name: "疾羽獵鷹",
    		cardCode: "01DE029",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO037.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO037-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "本回合給予1個友軍單位<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>與<link=keyword.Lifesteal><sprite name=Lifesteal><style=Keyword>吸血</style></link>。",
    		descriptionRaw: "本回合給予1個友軍單位光盾與吸血。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「這把刀曾屬於我父親。希望它能為你帶來我曾一度缺乏的力量。」——慎",
    		artistName: "Kudos Productions",
    		name: "靈氣庇護",
    		cardCode: "01IO037",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T8.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ056T8-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 4,
    		cost: 4,
    		health: 1,
    		description: "<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。",
    		descriptionRaw: "飛逝。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「啊，科學的美妙氣味！砲臺成功升級了！我得說……看到這個全新機型，我連脊椎都打起寒顫了！嗚呼！」——《漢默丁格的實驗室手札》第4冊",
    		artistName: "SIXMOREVODKA",
    		name: "Mk4：究極砲臺",
    		cardCode: "01PZ056T8",
    		keywords: [
    			"威嚇"
    		],
    		keywordRefs: [
    			"Fearsome"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "科技",
    		subtypes: [
    			"科技"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR024T3",
    			"01FR024T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR024T4.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR024T4-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 1,
    		health: 2,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "<link=vocab.RoundStart><style=Vocab>回合開始：</style></link>若我方進入<link=keyword.Enlightened><style=Keyword>開悟</style></link>狀態，將此牌幻化為<link=card.level1><style=AssociatedCard>艾妮維亞</style></link>並升級。",
    		levelupDescriptionRaw: "回合開始：若我方進入開悟狀態，將此牌幻化為艾妮維亞並升級。",
    		flavorText: "在刺骨寒氣環繞之下，弗雷爾卓德的守護者等待着她的歸來之時。",
    		artistName: "SIXMOREVODKA",
    		name: "蛋妮維亞",
    		cardCode: "01FR024T4",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ026.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ026-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "賦予1個友軍單位<link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>。",
    		descriptionRaw: "賦予1個友軍單位隱密。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「皮爾托福人老是以為自己無所不知，但是少了我們的指點，他們根本看不懂這裡的地圖！當地人才懂的資訊最珍貴了。當然我也可以分享……只要你願意掏腰包就行。」——汙水坑拾荒者，阿朱納．雷姆",
    		artistName: "Kudos Productions",
    		name: "汙水坑地圖",
    		cardCode: "01PZ026",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX019-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予1個友軍單位+3|+0與<link=keyword.Overwhelm><sprite name=Overwhelm><style=Keyword>勢不可擋</style></link>。",
    		descriptionRaw: "本回合給予1個友軍單位+3|+0與勢不可擋。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我說過縝密戰略沒那麼重要，不代表不好，只是真的沒那麼重要。」——達瑞斯",
    		artistName: "Kudos Productions",
    		name: "實力至上",
    		cardCode: "01NX019",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE028.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE028-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 5,
    		cost: 5,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "無畏先鋒不靠鼓聲或樂曲，而是僅靠馬蹄踩踏地面發出的規律節奏來記錄行軍時間。",
    		artistName: "SIXMOREVODKA",
    		name: "先鋒騎兵",
    		cardCode: "01DE028",
    		keywords: [
    			"堅忍"
    		],
    		keywordRefs: [
    			"Tough"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "菁英",
    		subtypes: [
    			"菁英"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO043.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO043-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 3,
    		health: 1,
    		description: "<link=vocab.Strike><style=Vocab>打擊</style></link>：抽1張法術。",
    		descriptionRaw: "打擊：抽1張法術。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們是最初淨土引以為傲的兒女。淨土魔法在我們的梵斯塔雅血脈中流動，甚至遍布整座王國。」",
    		artistName: "SIXMOREVODKA",
    		name: "人魚術士",
    		cardCode: "01IO043",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ043.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ043-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Nexus Strike><style=Vocab>打擊主堡</style></link>：在手牌生成1張來自敵方牌組的隨機法術。",
    		descriptionRaw: "打擊主堡：在手牌生成1張來自敵方牌組的隨機法術。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "進步之城底層的那群傢伙本來應該相互廝殺，沒想到他們團結起來，互助合作，打造了一個新家——佐恩，雖然不怎麼理想，但至少是屬於他們的領地。",
    		artistName: "SIXMOREVODKA",
    		name: "化學龐克扒手",
    		cardCode: "01PZ043",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR032.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR032-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "施放法術時，賦予牌組最上方的友軍單位+1|+1。",
    		descriptionRaw: "施放法術時，賦予牌組最上方的友軍單位+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「賦予他們敏銳的雙耳聆聽吹來的風、輕盈的腳步跨越即將來臨的風雪、清晰的雙眼看穿冬日的陰霾。」",
    		artistName: "SIXMOREVODKA",
    		name: "星光先知",
    		cardCode: "01FR032",
    		keywords: [
    			"灌輸"
    		],
    		keywordRefs: [
    			"Imbue"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO038.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO038-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 3,
    		health: 3,
    		description: "召喚此牌時，<link=keyword.Recall><style=Keyword>召回</style></link>所有其他友軍單位。",
    		descriptionRaw: "召喚此牌時，召回所有其他友軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「反射動作與本能是我唯一渴望的陪伴。」",
    		artistName: "SIXMOREVODKA",
    		name: "獨身修女",
    		cardCode: "01IO038",
    		keywords: [
    			"隱密"
    		],
    		keywordRefs: [
    			"Elusive"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR052T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR052.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR052-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 10,
    		cost: 10,
    		health: 10,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：<link=keyword.Obliterate><style=Keyword>泯滅</style></link>手牌及場上所有力量值4或以下的侍從單位。",
    		descriptionRaw: "出牌：泯滅手牌及場上所有力量值4或以下的侍從單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我從碎石堆中站起身，發現周圍地上燒出一圈烙印。夥伴曾經站立的地方成了一堆悶燒的灰燼，而不遠處有個若隱若現的形體邁步向前……」——漫遊者比亞",
    		artistName: "SIXMOREVODKA",
    		name: "虛厄遊獸",
    		cardCode: "01FR052",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR028"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR051.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR051-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "若我方場上有雪怪單位，則召喚1個<link=card.create><style=AssociatedCard>暴怒雪怪</style></link>。若無，則生成1張放在牌組最上方。",
    		descriptionRaw: "若我方場上有雪怪單位，則召喚1個暴怒雪怪。若無，則生成1張放在牌組最上方。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「……這傢伙的嘴巴滿是參差不齊的牙齒、雙拳充滿破壞力、眼神憤怒到極致，吼聲還能撼動大樹！比亞叔叔是這麼跟我說的！」——青年英格瓦",
    		artistName: "SIXMOREVODKA",
    		name: "荒誕傳說",
    		cardCode: "01FR051",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX022"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX022-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "擊殺1個負傷單位後，在手牌生成1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.me><style=AssociatedCard>諾克薩斯斷頭台</style></link>。",
    		descriptionRaw: "擊殺1個負傷單位後，在手牌生成1張飛逝諾克薩斯斷頭台。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "迅速了結對手，即是達瑞斯的仁慈。",
    		artistName: "SIXMOREVODKA",
    		name: "諾克薩斯斷頭台",
    		cardCode: "01NX022",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ047.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01PZ047-full.png"
    			}
    		],
    		region: "皮爾托福 & 佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 1,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：對雙方主堡各造成1點傷害。",
    		descriptionRaw: "遺願：對雙方主堡各造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你大可以穿防護服，但是一穿起來就跟呼碰的胳肢窩一樣，悶熱得要人命。手套或許還行？如果那黏答答的東西不小心沾到身上，你最好祈禱別沾到什麼重要部位。」——佐恩工頭，齊爾．艾可思",
    		artistName: "SIXMOREVODKA",
    		name: "腐蝕藥劑桶",
    		cardCode: "01PZ047",
    		keywords: [
    			"遺願",
    			"閃靈"
    		],
    		keywordRefs: [
    			"LastBreath",
    			"Ephemeral"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI026.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI026-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：在手牌生成1張具有<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>特性、不分區域，且魔耗值3以下的其它侍從牌。",
    		descriptionRaw: "遺願：在手牌生成1張具有遺願特性、不分區域，且魔耗值3以下的其它侍從牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "他用盡全力屏住呼吸，祈禱獄長別發現自己。當時的他還不曉得，這場躲貓貓只不過是瑟雷西一連串恐怖折磨的開頭罷了……",
    		artistName: "SIXMOREVODKA",
    		name: "獄長的獵物",
    		cardCode: "01SI026",
    		keywords: [
    			"遺願"
    		],
    		keywordRefs: [
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO012T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO012T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予1個友軍單位+3|+0。",
    		descriptionRaw: "本回合給予1個友軍單位+3|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "",
    		artistName: "SIXMOREVODKA",
    		name: "力量之戒律",
    		cardCode: "01IO012T1",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE054.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE054-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "召喚此牌時，若本回合有友軍單位陣亡，則抽1張單位牌。",
    		descriptionRaw: "召喚此牌時，若本回合有友軍單位陣亡，則抽1張單位牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「作戰吶喊的每一聲、揮出的每一劍，盾牌的每一次撞擊，都是對捐軀將士的緬懷！今天，我們勝券在握！」",
    		artistName: "SIXMOREVODKA",
    		name: "先鋒贖士",
    		cardCode: "01DE054",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "菁英",
    		subtypes: [
    			"菁英"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO041",
    			"01IO041T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO041T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO041T2-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "在手牌隨機生成1張其它法術。\r\n<link=keyword.Enlightened><style=Keyword>開悟</style></link>：改為生成2張。\r\n將1張<link=card.level1><style=AssociatedCard>卡瑪</style></link>洗入我方牌組。",
    		descriptionRaw: "在手牌隨機生成1張其它法術。\r\n開悟：改為生成2張。\r\n將1張卡瑪洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「希望渺茫時，記得你不是孤身一人。過往一直與我們同在，無數個明天將帶來希望。」——卡瑪",
    		artistName: "Kudos Productions",
    		name: "卡瑪 亙古洞悉",
    		cardCode: "01IO041T2",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO009T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO039.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO039-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "<link=keyword.Recall><style=Keyword>召回</style></link>1個友軍單位，召喚1個<link=card.create><style=AssociatedCard>疾風殘影</style></link>取而代之。",
    		descriptionRaw: "召回1個友軍單位，召喚1個疾風殘影取而代之。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "你眼前的敵人確實存在嗎？還是說，它只是暗影的障眼法？",
    		artistName: "Max Grecke",
    		name: "移形換影",
    		cardCode: "01IO039",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX032.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX032-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 5,
    		cost: 4,
    		health: 5,
    		description: "召喚此牌時，對其他友軍單位造成1點傷害。",
    		descriptionRaw: "召喚此牌時，對其他友軍單位造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「恕我直言，就算我拒絕，你們還是會硬拉我去。所以……當然會囉。」",
    		artistName: "SIXMOREVODKA",
    		name: "血色覺醒者",
    		cardCode: "01NX032",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE025"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE023.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE023-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "若我方在本牌局已施放1張魔耗值6點或以上的法術牌，則生成1張<link=card.create><style=AssociatedCard>束縛</style></link>。",
    		descriptionRaw: "若我方在本牌局已施放1張魔耗值6點或以上的法術牌，則生成1張束縛。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「抱歉，打擾了。麻煩您全力配合調查。我們注意到一些……『不尋常的事』……」",
    		artistName: "SIXMOREVODKA",
    		name: "獵魔調查員",
    		cardCode: "01DE023",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX024.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX024-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 5,
    		cost: 5,
    		health: 4,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：本回合給予此牌支援的友軍單位+3|+0與<link=keyword.Overwhelm><sprite name=Overwhelm><style=Keyword>勢不可擋</style></link>。",
    		descriptionRaw: "支援：本回合給予此牌支援的友軍單位+3|+0與勢不可擋。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「席菈扎是個很棒的女友——我是說朋友，我們絕對沒有在交往。但假設我們正在交往，我想對她說，週年紀念日快樂。提問到此結束，謝謝。」",
    		artistName: "SIXMOREVODKA",
    		name: "神臂加登",
    		cardCode: "01NX024",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI040.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI040-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "從1個單位<link=keyword.Drain><style=Keyword>汲取</style></link>1點生命值，召喚1個<link=card.create><style=AssociatedCard>小蜘蛛</style></link>。",
    		descriptionRaw: "從1個單位汲取1點生命值，召喚1個小蜘蛛。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「夫……夫人！我不曉得妳……這麼喜歡蜘蛛！能否請妳命令牠們別爬上來？伊、伊莉絲夫人？求求妳？」——倒楣的貴族，薩森領主",
    		artistName: "Kudos Productions",
    		name: "惡趣胃",
    		cardCode: "01SI040",
    		keywords: [
    			"快速"
    		],
    		keywordRefs: [
    			"Fast"
    		],
    		spellSpeed: "快速",
    		spellSpeedRef: "Fast",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR034.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR034-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 1,
    		cost: 6,
    		health: 1,
    		description: "召喚此牌時，每有1個友軍單位陣亡，則賦予此牌+1|+1。",
    		descriptionRaw: "召喚此牌時，每有1個友軍單位陣亡，則賦予此牌+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「唉，老比亞經歷了一些事情，在北方失去了手下。他幾個月後歸來，整個人臉色蒼白，語無倫次。現在只會喃喃重複『巨大野獸』、『超大利爪』。真是可憐……」——小酒館老闆",
    		artistName: "SIXMOREVODKA",
    		name: "虛厄韌獸",
    		cardCode: "01FR034",
    		keywords: [
    			"勢不可擋"
    		],
    		keywordRefs: [
    			"Overwhelm"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE051.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE051-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 6,
    		cost: 6,
    		health: 6,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：本回合給予其他戰鬥中友軍單位+1|+1與<link=keyword.Fearsome><sprite name=Fearsome><style=Keyword>威嚇</style></link>。",
    		descriptionRaw: "攻擊：本回合給予其他戰鬥中友軍單位+1|+1與威嚇。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「對我而言，傳說和軼事不只是虛構情節，這些偉大的冒險好像在呼喚著我。我離開克勞菲爾德，探尋屬於自己的旅程，才發現這不過是起點，未來還有更多冒險等著我去體驗。」\n",
    		artistName: "SIXMOREVODKA",
    		name: "驍勇戰士希莉亞",
    		cardCode: "01DE051",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "菁英",
    		subtypes: [
    			"菁英"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO056T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO056.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO056-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 6,
    		cost: 7,
    		health: 6,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>2個敵軍單位。",
    		descriptionRaw: "出牌：擊暈2個敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「小時候我曾問弟弟：『起風是代表風在逃逸，還是追隨？』那時他追隨在我身後是為了尋求指引。現在我追隨在他身後則是為了伸張正義。」\n",
    		artistName: "Aron Elekes",
    		name: "追風者．犽凝",
    		cardCode: "01IO056",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO055.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01IO055-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "賦予手牌中1個友軍單位<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。\r\n抽1張牌。",
    		descriptionRaw: "賦予手牌中1個友軍單位光盾。\r\n抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「維持平衡之人，應當知曉保護均衡的力量。」——慎\n",
    		artistName: "Kudos Productions",
    		name: "靈氣守護者",
    		cardCode: "01IO055",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE044.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE044-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "完全治癒1個友軍單位，並使其力量值與生命值加倍。",
    		descriptionRaw: "完全治癒1個友軍單位，並使其力量值與生命值加倍。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "在蒂瑪西亞，以一擋二可不是吹牛自誇。",
    		artistName: "Rafael Zanchetin",
    		name: "加倍勇猛",
    		cardCode: "01DE044",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI015.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI015-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 9,
    		health: 0,
    		description: "擊殺場上所有單位。",
    		descriptionRaw: "擊殺場上所有單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "誰能料到如愛這般純粹的情感，也會招來全面毀滅的殘酷結局。 ",
    		artistName: "Oliver Chipping",
    		name: "殞落王者的詛咒",
    		cardCode: "01SI015",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI052T2",
    			"01SI052"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI052T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI052T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 5,
    		health: 7,
    		description: "此牌在本牌局初次攻擊時，從牌組或手牌召喚另1個攻擊中的英雄。",
    		descriptionRaw: "此牌在本牌局初次攻擊時，從牌組或手牌召喚另1個攻擊中的英雄。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你是我的了，永世不得超生。」鎖鏈鏗鏘，獄長就在你後方...",
    		artistName: "SIXMOREVODKA",
    		name: "瑟雷西",
    		cardCode: "01SI052T1",
    		keywords: [
    			"挑戰者"
    		],
    		keywordRefs: [
    			"Challenger"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX049.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX049-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>1個敵軍單位。",
    		descriptionRaw: "擊暈1個敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「最好留點繩子給敵人，好讓他們自縊，省得還要一路拖到絞刑台。」——勒布朗",
    		artistName: "Kudos Productions",
    		name: "狡詐",
    		cardCode: "01NX049",
    		keywords: [
    			"慢速"
    		],
    		keywordRefs: [
    			"Slow"
    		],
    		spellSpeed: "慢速",
    		spellSpeedRef: "Slow",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR007-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "召喚此牌時，抽1張力量值5點或以上的單位牌。",
    		descriptionRaw: "召喚此牌時，抽1張力量值5點或以上的單位牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你……你必須相信我！那是隻巨獸。我真心不騙，超巨大！」",
    		artistName: "SIXMOREVODKA",
    		name: "碎碎念的比亞",
    		cardCode: "01FR007",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE012T1",
    			"01DE012T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01DE012-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 5,
    		cost: 5,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "此牌<link=vocab.Strike><style=Vocab>打擊</style></link>兩次<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌打擊兩次。",
    		flavorText: "千錘百鍊的堅毅才能造就精兵，即便面對死亡的巨大威脅，我們也不會動搖半分。",
    		artistName: "SIXMOREVODKA",
    		name: "蓋倫",
    		cardCode: "01DE012",
    		keywords: [
    			"再生"
    		],
    		keywordRefs: [
    			"Regeneration"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "菁英",
    		subtypes: [
    			"菁英"
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX020"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX020T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01NX020T1-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "棄置1張牌即可出此牌。\r\n本回合給予1個友軍單位+1|+0。",
    		descriptionRaw: "棄置1張牌即可出此牌。\r\n本回合給予1個友軍單位+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「如果是一對一肉搏戰，他哥哥八成會贏。但是看看那些斧頭飛旋的模樣……那是一門技藝啊。了不起的技藝。」——競技場常客",
    		artistName: "SIXMOREVODKA",
    		name: "迴旋飛斧",
    		cardCode: "01NX020T1",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01FR003-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 2,
    		cost: 2,
    		health: 1,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：抽1張牌。",
    		descriptionRaw: "遺願：抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我曾經遠征戰場尋找自己的立足之地。現在，我在農場和家人的陪伴下找到安身之處。我是他們的雙眼，他們的安全就是我的責任。」",
    		artistName: "SIXMOREVODKA",
    		name: "艾伐洛森哨兵",
    		cardCode: "01FR003",
    		keywords: [
    			"遺願"
    		],
    		keywordRefs: [
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI055.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI055-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 3,
    		cost: 6,
    		health: 7,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「隨著船隻駛近陰森的海岸，我心想：『那些夢靨般的造物就是來自這些詭譎的沿海地區嗎？它們擁有過生命嗎？』」——蒂瑪西亞士兵，阿里．倫斯",
    		artistName: "SIXMOREVODKA",
    		name: "食魂巨魔",
    		cardCode: "01SI055",
    		keywords: [
    			"吸血"
    		],
    		keywordRefs: [
    			"Lifesteal"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI047.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_0_0/set1/zh_tw/img/cards/01SI047-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "選1個侍從單位。在手牌生成1張與之相同的<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>複製牌。",
    		descriptionRaw: "選1個侍從單位。在手牌生成1張與之相同的閃靈複製牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "片刻之間，回憶映在眼簾。斑斑日光在她的肌膚上跳躍，飽滿多汁的黑刺莓在齒間迸裂，林地微風傳來悠悠樂聲，拂過她的耳邊。然後……畫面消失了。",
    		artistName: "Kudos Productions",
    		name: "褪色回憶",
    		cardCode: "01SI047",
    		keywords: [
    			"疾速"
    		],
    		keywordRefs: [
    			"Burst"
    		],
    		spellSpeed: "疾速",
    		spellSpeedRef: "Burst",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "法術",
    		collectible: true
    	}
    ];

    /* src/Sets.svelte generated by Svelte v3.21.0 */

    const cardSets = {};
    cardSets[1] = set1;
    cardSets[2] = set2;

    var has = Object.prototype.hasOwnProperty;
    var isArray = Array.isArray;

    var hexTable = (function () {
        var array = [];
        for (var i = 0; i < 256; ++i) {
            array.push('%' + ((i < 16 ? '0' : '') + i.toString(16)).toUpperCase());
        }

        return array;
    }());

    var compactQueue = function compactQueue(queue) {
        while (queue.length > 1) {
            var item = queue.pop();
            var obj = item.obj[item.prop];

            if (isArray(obj)) {
                var compacted = [];

                for (var j = 0; j < obj.length; ++j) {
                    if (typeof obj[j] !== 'undefined') {
                        compacted.push(obj[j]);
                    }
                }

                item.obj[item.prop] = compacted;
            }
        }
    };

    var arrayToObject = function arrayToObject(source, options) {
        var obj = options && options.plainObjects ? Object.create(null) : {};
        for (var i = 0; i < source.length; ++i) {
            if (typeof source[i] !== 'undefined') {
                obj[i] = source[i];
            }
        }

        return obj;
    };

    var merge = function merge(target, source, options) {
        /* eslint no-param-reassign: 0 */
        if (!source) {
            return target;
        }

        if (typeof source !== 'object') {
            if (isArray(target)) {
                target.push(source);
            } else if (target && typeof target === 'object') {
                if ((options && (options.plainObjects || options.allowPrototypes)) || !has.call(Object.prototype, source)) {
                    target[source] = true;
                }
            } else {
                return [target, source];
            }

            return target;
        }

        if (!target || typeof target !== 'object') {
            return [target].concat(source);
        }

        var mergeTarget = target;
        if (isArray(target) && !isArray(source)) {
            mergeTarget = arrayToObject(target, options);
        }

        if (isArray(target) && isArray(source)) {
            source.forEach(function (item, i) {
                if (has.call(target, i)) {
                    var targetItem = target[i];
                    if (targetItem && typeof targetItem === 'object' && item && typeof item === 'object') {
                        target[i] = merge(targetItem, item, options);
                    } else {
                        target.push(item);
                    }
                } else {
                    target[i] = item;
                }
            });
            return target;
        }

        return Object.keys(source).reduce(function (acc, key) {
            var value = source[key];

            if (has.call(acc, key)) {
                acc[key] = merge(acc[key], value, options);
            } else {
                acc[key] = value;
            }
            return acc;
        }, mergeTarget);
    };

    var assign = function assignSingleSource(target, source) {
        return Object.keys(source).reduce(function (acc, key) {
            acc[key] = source[key];
            return acc;
        }, target);
    };

    var decode = function (str, decoder, charset) {
        var strWithoutPlus = str.replace(/\+/g, ' ');
        if (charset === 'iso-8859-1') {
            // unescape never throws, no try...catch needed:
            return strWithoutPlus.replace(/%[0-9a-f]{2}/gi, unescape);
        }
        // utf-8
        try {
            return decodeURIComponent(strWithoutPlus);
        } catch (e) {
            return strWithoutPlus;
        }
    };

    var encode = function encode(str, defaultEncoder, charset) {
        // This code was originally written by Brian White (mscdex) for the io.js core querystring library.
        // It has been adapted here for stricter adherence to RFC 3986
        if (str.length === 0) {
            return str;
        }

        var string = str;
        if (typeof str === 'symbol') {
            string = Symbol.prototype.toString.call(str);
        } else if (typeof str !== 'string') {
            string = String(str);
        }

        if (charset === 'iso-8859-1') {
            return escape(string).replace(/%u[0-9a-f]{4}/gi, function ($0) {
                return '%26%23' + parseInt($0.slice(2), 16) + '%3B';
            });
        }

        var out = '';
        for (var i = 0; i < string.length; ++i) {
            var c = string.charCodeAt(i);

            if (
                c === 0x2D // -
                || c === 0x2E // .
                || c === 0x5F // _
                || c === 0x7E // ~
                || (c >= 0x30 && c <= 0x39) // 0-9
                || (c >= 0x41 && c <= 0x5A) // a-z
                || (c >= 0x61 && c <= 0x7A) // A-Z
            ) {
                out += string.charAt(i);
                continue;
            }

            if (c < 0x80) {
                out = out + hexTable[c];
                continue;
            }

            if (c < 0x800) {
                out = out + (hexTable[0xC0 | (c >> 6)] + hexTable[0x80 | (c & 0x3F)]);
                continue;
            }

            if (c < 0xD800 || c >= 0xE000) {
                out = out + (hexTable[0xE0 | (c >> 12)] + hexTable[0x80 | ((c >> 6) & 0x3F)] + hexTable[0x80 | (c & 0x3F)]);
                continue;
            }

            i += 1;
            c = 0x10000 + (((c & 0x3FF) << 10) | (string.charCodeAt(i) & 0x3FF));
            out += hexTable[0xF0 | (c >> 18)]
                + hexTable[0x80 | ((c >> 12) & 0x3F)]
                + hexTable[0x80 | ((c >> 6) & 0x3F)]
                + hexTable[0x80 | (c & 0x3F)];
        }

        return out;
    };

    var compact = function compact(value) {
        var queue = [{ obj: { o: value }, prop: 'o' }];
        var refs = [];

        for (var i = 0; i < queue.length; ++i) {
            var item = queue[i];
            var obj = item.obj[item.prop];

            var keys = Object.keys(obj);
            for (var j = 0; j < keys.length; ++j) {
                var key = keys[j];
                var val = obj[key];
                if (typeof val === 'object' && val !== null && refs.indexOf(val) === -1) {
                    queue.push({ obj: obj, prop: key });
                    refs.push(val);
                }
            }
        }

        compactQueue(queue);

        return value;
    };

    var isRegExp = function isRegExp(obj) {
        return Object.prototype.toString.call(obj) === '[object RegExp]';
    };

    var isBuffer = function isBuffer(obj) {
        if (!obj || typeof obj !== 'object') {
            return false;
        }

        return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj));
    };

    var combine = function combine(a, b) {
        return [].concat(a, b);
    };

    var utils = {
        arrayToObject: arrayToObject,
        assign: assign,
        combine: combine,
        compact: compact,
        decode: decode,
        encode: encode,
        isBuffer: isBuffer,
        isRegExp: isRegExp,
        merge: merge
    };

    var replace = String.prototype.replace;
    var percentTwenties = /%20/g;



    var Format = {
        RFC1738: 'RFC1738',
        RFC3986: 'RFC3986'
    };

    var formats = utils.assign(
        {
            'default': Format.RFC3986,
            formatters: {
                RFC1738: function (value) {
                    return replace.call(value, percentTwenties, '+');
                },
                RFC3986: function (value) {
                    return String(value);
                }
            }
        },
        Format
    );

    var has$1 = Object.prototype.hasOwnProperty;

    var arrayPrefixGenerators = {
        brackets: function brackets(prefix) {
            return prefix + '[]';
        },
        comma: 'comma',
        indices: function indices(prefix, key) {
            return prefix + '[' + key + ']';
        },
        repeat: function repeat(prefix) {
            return prefix;
        }
    };

    var isArray$1 = Array.isArray;
    var push = Array.prototype.push;
    var pushToArray = function (arr, valueOrArray) {
        push.apply(arr, isArray$1(valueOrArray) ? valueOrArray : [valueOrArray]);
    };

    var toISO = Date.prototype.toISOString;

    var defaultFormat = formats['default'];
    var defaults = {
        addQueryPrefix: false,
        allowDots: false,
        charset: 'utf-8',
        charsetSentinel: false,
        delimiter: '&',
        encode: true,
        encoder: utils.encode,
        encodeValuesOnly: false,
        format: defaultFormat,
        formatter: formats.formatters[defaultFormat],
        // deprecated
        indices: false,
        serializeDate: function serializeDate(date) {
            return toISO.call(date);
        },
        skipNulls: false,
        strictNullHandling: false
    };

    var isNonNullishPrimitive = function isNonNullishPrimitive(v) {
        return typeof v === 'string'
            || typeof v === 'number'
            || typeof v === 'boolean'
            || typeof v === 'symbol'
            || typeof v === 'bigint';
    };

    var stringify = function stringify(
        object,
        prefix,
        generateArrayPrefix,
        strictNullHandling,
        skipNulls,
        encoder,
        filter,
        sort,
        allowDots,
        serializeDate,
        formatter,
        encodeValuesOnly,
        charset
    ) {
        var obj = object;
        if (typeof filter === 'function') {
            obj = filter(prefix, obj);
        } else if (obj instanceof Date) {
            obj = serializeDate(obj);
        } else if (generateArrayPrefix === 'comma' && isArray$1(obj)) {
            obj = obj.join(',');
        }

        if (obj === null) {
            if (strictNullHandling) {
                return encoder && !encodeValuesOnly ? encoder(prefix, defaults.encoder, charset, 'key') : prefix;
            }

            obj = '';
        }

        if (isNonNullishPrimitive(obj) || utils.isBuffer(obj)) {
            if (encoder) {
                var keyValue = encodeValuesOnly ? prefix : encoder(prefix, defaults.encoder, charset, 'key');
                return [formatter(keyValue) + '=' + formatter(encoder(obj, defaults.encoder, charset, 'value'))];
            }
            return [formatter(prefix) + '=' + formatter(String(obj))];
        }

        var values = [];

        if (typeof obj === 'undefined') {
            return values;
        }

        var objKeys;
        if (isArray$1(filter)) {
            objKeys = filter;
        } else {
            var keys = Object.keys(obj);
            objKeys = sort ? keys.sort(sort) : keys;
        }

        for (var i = 0; i < objKeys.length; ++i) {
            var key = objKeys[i];

            if (skipNulls && obj[key] === null) {
                continue;
            }

            if (isArray$1(obj)) {
                pushToArray(values, stringify(
                    obj[key],
                    typeof generateArrayPrefix === 'function' ? generateArrayPrefix(prefix, key) : prefix,
                    generateArrayPrefix,
                    strictNullHandling,
                    skipNulls,
                    encoder,
                    filter,
                    sort,
                    allowDots,
                    serializeDate,
                    formatter,
                    encodeValuesOnly,
                    charset
                ));
            } else {
                pushToArray(values, stringify(
                    obj[key],
                    prefix + (allowDots ? '.' + key : '[' + key + ']'),
                    generateArrayPrefix,
                    strictNullHandling,
                    skipNulls,
                    encoder,
                    filter,
                    sort,
                    allowDots,
                    serializeDate,
                    formatter,
                    encodeValuesOnly,
                    charset
                ));
            }
        }

        return values;
    };

    var normalizeStringifyOptions = function normalizeStringifyOptions(opts) {
        if (!opts) {
            return defaults;
        }

        if (opts.encoder !== null && opts.encoder !== undefined && typeof opts.encoder !== 'function') {
            throw new TypeError('Encoder has to be a function.');
        }

        var charset = opts.charset || defaults.charset;
        if (typeof opts.charset !== 'undefined' && opts.charset !== 'utf-8' && opts.charset !== 'iso-8859-1') {
            throw new TypeError('The charset option must be either utf-8, iso-8859-1, or undefined');
        }

        var format = formats['default'];
        if (typeof opts.format !== 'undefined') {
            if (!has$1.call(formats.formatters, opts.format)) {
                throw new TypeError('Unknown format option provided.');
            }
            format = opts.format;
        }
        var formatter = formats.formatters[format];

        var filter = defaults.filter;
        if (typeof opts.filter === 'function' || isArray$1(opts.filter)) {
            filter = opts.filter;
        }

        return {
            addQueryPrefix: typeof opts.addQueryPrefix === 'boolean' ? opts.addQueryPrefix : defaults.addQueryPrefix,
            allowDots: typeof opts.allowDots === 'undefined' ? defaults.allowDots : !!opts.allowDots,
            charset: charset,
            charsetSentinel: typeof opts.charsetSentinel === 'boolean' ? opts.charsetSentinel : defaults.charsetSentinel,
            delimiter: typeof opts.delimiter === 'undefined' ? defaults.delimiter : opts.delimiter,
            encode: typeof opts.encode === 'boolean' ? opts.encode : defaults.encode,
            encoder: typeof opts.encoder === 'function' ? opts.encoder : defaults.encoder,
            encodeValuesOnly: typeof opts.encodeValuesOnly === 'boolean' ? opts.encodeValuesOnly : defaults.encodeValuesOnly,
            filter: filter,
            formatter: formatter,
            serializeDate: typeof opts.serializeDate === 'function' ? opts.serializeDate : defaults.serializeDate,
            skipNulls: typeof opts.skipNulls === 'boolean' ? opts.skipNulls : defaults.skipNulls,
            sort: typeof opts.sort === 'function' ? opts.sort : null,
            strictNullHandling: typeof opts.strictNullHandling === 'boolean' ? opts.strictNullHandling : defaults.strictNullHandling
        };
    };

    var stringify_1 = function (object, opts) {
        var obj = object;
        var options = normalizeStringifyOptions(opts);

        var objKeys;
        var filter;

        if (typeof options.filter === 'function') {
            filter = options.filter;
            obj = filter('', obj);
        } else if (isArray$1(options.filter)) {
            filter = options.filter;
            objKeys = filter;
        }

        var keys = [];

        if (typeof obj !== 'object' || obj === null) {
            return '';
        }

        var arrayFormat;
        if (opts && opts.arrayFormat in arrayPrefixGenerators) {
            arrayFormat = opts.arrayFormat;
        } else if (opts && 'indices' in opts) {
            arrayFormat = opts.indices ? 'indices' : 'repeat';
        } else {
            arrayFormat = 'indices';
        }

        var generateArrayPrefix = arrayPrefixGenerators[arrayFormat];

        if (!objKeys) {
            objKeys = Object.keys(obj);
        }

        if (options.sort) {
            objKeys.sort(options.sort);
        }

        for (var i = 0; i < objKeys.length; ++i) {
            var key = objKeys[i];

            if (options.skipNulls && obj[key] === null) {
                continue;
            }
            pushToArray(keys, stringify(
                obj[key],
                key,
                generateArrayPrefix,
                options.strictNullHandling,
                options.skipNulls,
                options.encode ? options.encoder : null,
                options.filter,
                options.sort,
                options.allowDots,
                options.serializeDate,
                options.formatter,
                options.encodeValuesOnly,
                options.charset
            ));
        }

        var joined = keys.join(options.delimiter);
        var prefix = options.addQueryPrefix === true ? '?' : '';

        if (options.charsetSentinel) {
            if (options.charset === 'iso-8859-1') {
                // encodeURIComponent('&#10003;'), the "numeric entity" representation of a checkmark
                prefix += 'utf8=%26%2310003%3B&';
            } else {
                // encodeURIComponent('✓')
                prefix += 'utf8=%E2%9C%93&';
            }
        }

        return joined.length > 0 ? prefix + joined : '';
    };

    var has$2 = Object.prototype.hasOwnProperty;
    var isArray$2 = Array.isArray;

    var defaults$1 = {
        allowDots: false,
        allowPrototypes: false,
        arrayLimit: 20,
        charset: 'utf-8',
        charsetSentinel: false,
        comma: false,
        decoder: utils.decode,
        delimiter: '&',
        depth: 5,
        ignoreQueryPrefix: false,
        interpretNumericEntities: false,
        parameterLimit: 1000,
        parseArrays: true,
        plainObjects: false,
        strictNullHandling: false
    };

    var interpretNumericEntities = function (str) {
        return str.replace(/&#(\d+);/g, function ($0, numberStr) {
            return String.fromCharCode(parseInt(numberStr, 10));
        });
    };

    var parseArrayValue = function (val, options) {
        if (val && typeof val === 'string' && options.comma && val.indexOf(',') > -1) {
            return val.split(',');
        }

        return val;
    };

    var maybeMap = function maybeMap(val, fn) {
        if (isArray$2(val)) {
            var mapped = [];
            for (var i = 0; i < val.length; i += 1) {
                mapped.push(fn(val[i]));
            }
            return mapped;
        }
        return fn(val);
    };

    // This is what browsers will submit when the ✓ character occurs in an
    // application/x-www-form-urlencoded body and the encoding of the page containing
    // the form is iso-8859-1, or when the submitted form has an accept-charset
    // attribute of iso-8859-1. Presumably also with other charsets that do not contain
    // the ✓ character, such as us-ascii.
    var isoSentinel = 'utf8=%26%2310003%3B'; // encodeURIComponent('&#10003;')

    // These are the percent-encoded utf-8 octets representing a checkmark, indicating that the request actually is utf-8 encoded.
    var charsetSentinel = 'utf8=%E2%9C%93'; // encodeURIComponent('✓')

    var parseValues = function parseQueryStringValues(str, options) {
        var obj = {};
        var cleanStr = options.ignoreQueryPrefix ? str.replace(/^\?/, '') : str;
        var limit = options.parameterLimit === Infinity ? undefined : options.parameterLimit;
        var parts = cleanStr.split(options.delimiter, limit);
        var skipIndex = -1; // Keep track of where the utf8 sentinel was found
        var i;

        var charset = options.charset;
        if (options.charsetSentinel) {
            for (i = 0; i < parts.length; ++i) {
                if (parts[i].indexOf('utf8=') === 0) {
                    if (parts[i] === charsetSentinel) {
                        charset = 'utf-8';
                    } else if (parts[i] === isoSentinel) {
                        charset = 'iso-8859-1';
                    }
                    skipIndex = i;
                    i = parts.length; // The eslint settings do not allow break;
                }
            }
        }

        for (i = 0; i < parts.length; ++i) {
            if (i === skipIndex) {
                continue;
            }
            var part = parts[i];

            var bracketEqualsPos = part.indexOf(']=');
            var pos = bracketEqualsPos === -1 ? part.indexOf('=') : bracketEqualsPos + 1;

            var key, val;
            if (pos === -1) {
                key = options.decoder(part, defaults$1.decoder, charset, 'key');
                val = options.strictNullHandling ? null : '';
            } else {
                key = options.decoder(part.slice(0, pos), defaults$1.decoder, charset, 'key');
                val = maybeMap(
                    parseArrayValue(part.slice(pos + 1), options),
                    function (encodedVal) {
                        return options.decoder(encodedVal, defaults$1.decoder, charset, 'value');
                    }
                );
            }

            if (val && options.interpretNumericEntities && charset === 'iso-8859-1') {
                val = interpretNumericEntities(val);
            }

            if (part.indexOf('[]=') > -1) {
                val = isArray$2(val) ? [val] : val;
            }

            if (has$2.call(obj, key)) {
                obj[key] = utils.combine(obj[key], val);
            } else {
                obj[key] = val;
            }
        }

        return obj;
    };

    var parseObject = function (chain, val, options, valuesParsed) {
        var leaf = valuesParsed ? val : parseArrayValue(val, options);

        for (var i = chain.length - 1; i >= 0; --i) {
            var obj;
            var root = chain[i];

            if (root === '[]' && options.parseArrays) {
                obj = [].concat(leaf);
            } else {
                obj = options.plainObjects ? Object.create(null) : {};
                var cleanRoot = root.charAt(0) === '[' && root.charAt(root.length - 1) === ']' ? root.slice(1, -1) : root;
                var index = parseInt(cleanRoot, 10);
                if (!options.parseArrays && cleanRoot === '') {
                    obj = { 0: leaf };
                } else if (
                    !isNaN(index)
                    && root !== cleanRoot
                    && String(index) === cleanRoot
                    && index >= 0
                    && (options.parseArrays && index <= options.arrayLimit)
                ) {
                    obj = [];
                    obj[index] = leaf;
                } else {
                    obj[cleanRoot] = leaf;
                }
            }

            leaf = obj; // eslint-disable-line no-param-reassign
        }

        return leaf;
    };

    var parseKeys = function parseQueryStringKeys(givenKey, val, options, valuesParsed) {
        if (!givenKey) {
            return;
        }

        // Transform dot notation to bracket notation
        var key = options.allowDots ? givenKey.replace(/\.([^.[]+)/g, '[$1]') : givenKey;

        // The regex chunks

        var brackets = /(\[[^[\]]*])/;
        var child = /(\[[^[\]]*])/g;

        // Get the parent

        var segment = options.depth > 0 && brackets.exec(key);
        var parent = segment ? key.slice(0, segment.index) : key;

        // Stash the parent if it exists

        var keys = [];
        if (parent) {
            // If we aren't using plain objects, optionally prefix keys that would overwrite object prototype properties
            if (!options.plainObjects && has$2.call(Object.prototype, parent)) {
                if (!options.allowPrototypes) {
                    return;
                }
            }

            keys.push(parent);
        }

        // Loop through children appending to the array until we hit depth

        var i = 0;
        while (options.depth > 0 && (segment = child.exec(key)) !== null && i < options.depth) {
            i += 1;
            if (!options.plainObjects && has$2.call(Object.prototype, segment[1].slice(1, -1))) {
                if (!options.allowPrototypes) {
                    return;
                }
            }
            keys.push(segment[1]);
        }

        // If there's a remainder, just add whatever is left

        if (segment) {
            keys.push('[' + key.slice(segment.index) + ']');
        }

        return parseObject(keys, val, options, valuesParsed);
    };

    var normalizeParseOptions = function normalizeParseOptions(opts) {
        if (!opts) {
            return defaults$1;
        }

        if (opts.decoder !== null && opts.decoder !== undefined && typeof opts.decoder !== 'function') {
            throw new TypeError('Decoder has to be a function.');
        }

        if (typeof opts.charset !== 'undefined' && opts.charset !== 'utf-8' && opts.charset !== 'iso-8859-1') {
            throw new TypeError('The charset option must be either utf-8, iso-8859-1, or undefined');
        }
        var charset = typeof opts.charset === 'undefined' ? defaults$1.charset : opts.charset;

        return {
            allowDots: typeof opts.allowDots === 'undefined' ? defaults$1.allowDots : !!opts.allowDots,
            allowPrototypes: typeof opts.allowPrototypes === 'boolean' ? opts.allowPrototypes : defaults$1.allowPrototypes,
            arrayLimit: typeof opts.arrayLimit === 'number' ? opts.arrayLimit : defaults$1.arrayLimit,
            charset: charset,
            charsetSentinel: typeof opts.charsetSentinel === 'boolean' ? opts.charsetSentinel : defaults$1.charsetSentinel,
            comma: typeof opts.comma === 'boolean' ? opts.comma : defaults$1.comma,
            decoder: typeof opts.decoder === 'function' ? opts.decoder : defaults$1.decoder,
            delimiter: typeof opts.delimiter === 'string' || utils.isRegExp(opts.delimiter) ? opts.delimiter : defaults$1.delimiter,
            // eslint-disable-next-line no-implicit-coercion, no-extra-parens
            depth: (typeof opts.depth === 'number' || opts.depth === false) ? +opts.depth : defaults$1.depth,
            ignoreQueryPrefix: opts.ignoreQueryPrefix === true,
            interpretNumericEntities: typeof opts.interpretNumericEntities === 'boolean' ? opts.interpretNumericEntities : defaults$1.interpretNumericEntities,
            parameterLimit: typeof opts.parameterLimit === 'number' ? opts.parameterLimit : defaults$1.parameterLimit,
            parseArrays: opts.parseArrays !== false,
            plainObjects: typeof opts.plainObjects === 'boolean' ? opts.plainObjects : defaults$1.plainObjects,
            strictNullHandling: typeof opts.strictNullHandling === 'boolean' ? opts.strictNullHandling : defaults$1.strictNullHandling
        };
    };

    var parse = function (str, opts) {
        var options = normalizeParseOptions(opts);

        if (str === '' || str === null || typeof str === 'undefined') {
            return options.plainObjects ? Object.create(null) : {};
        }

        var tempObj = typeof str === 'string' ? parseValues(str, options) : str;
        var obj = options.plainObjects ? Object.create(null) : {};

        // Iterate over the keys and setup the new object

        var keys = Object.keys(tempObj);
        for (var i = 0; i < keys.length; ++i) {
            var key = keys[i];
            var newObj = parseKeys(key, tempObj[key], options, typeof str === 'string');
            obj = utils.merge(obj, newObj, options);
        }

        return utils.compact(obj);
    };

    var lib = {
        formats: formats,
        parse: parse,
        stringify: stringify_1
    };

    /* src/CardBar.svelte generated by Svelte v3.21.0 */
    const file = "src/CardBar.svelte";

    function create_fragment(ctx) {
    	let cardblock;
    	let region_1;
    	let div0;
    	let span;
    	let t0;
    	let t1;
    	let div1;
    	let t2;
    	let t3;
    	let div2;
    	let t4;
    	let region_1_class_value;

    	const block = {
    		c: function create() {
    			cardblock = element("cardblock");
    			region_1 = element("region");
    			div0 = element("div");
    			span = element("span");
    			t0 = text(/*cost*/ ctx[3]);
    			t1 = space();
    			div1 = element("div");
    			t2 = text(/*name*/ ctx[2]);
    			t3 = space();
    			div2 = element("div");
    			t4 = text(/*count*/ ctx[0]);
    			add_location(span, file, 147, 6, 2997);
    			attr_dev(div0, "class", "cardcost svelte-1zfxan");
    			add_location(div0, file, 146, 4, 2968);
    			attr_dev(div1, "class", "cardname svelte-1zfxan");
    			add_location(div1, file, 149, 4, 3032);
    			attr_dev(div2, "class", "cardnums svelte-1zfxan");
    			add_location(div2, file, 150, 4, 3071);
    			attr_dev(region_1, "class", region_1_class_value = "" + (null_to_empty(/*region*/ ctx[4]) + " svelte-1zfxan"));
    			add_location(region_1, file, 145, 2, 2940);
    			set_style(cardblock, "background-image", "url(" + /*src*/ ctx[1] + ")");
    			attr_dev(cardblock, "class", "svelte-1zfxan");
    			add_location(cardblock, file, 144, 0, 2889);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, cardblock, anchor);
    			append_dev(cardblock, region_1);
    			append_dev(region_1, div0);
    			append_dev(div0, span);
    			append_dev(span, t0);
    			append_dev(region_1, t1);
    			append_dev(region_1, div1);
    			append_dev(div1, t2);
    			append_dev(region_1, t3);
    			append_dev(region_1, div2);
    			append_dev(div2, t4);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*cost*/ 8) set_data_dev(t0, /*cost*/ ctx[3]);
    			if (dirty & /*name*/ 4) set_data_dev(t2, /*name*/ ctx[2]);
    			if (dirty & /*count*/ 1) set_data_dev(t4, /*count*/ ctx[0]);

    			if (dirty & /*region*/ 16 && region_1_class_value !== (region_1_class_value = "" + (null_to_empty(/*region*/ ctx[4]) + " svelte-1zfxan"))) {
    				attr_dev(region_1, "class", region_1_class_value);
    			}

    			if (dirty & /*src*/ 2) {
    				set_style(cardblock, "background-image", "url(" + /*src*/ ctx[1] + ")");
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(cardblock);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { card } = $$props;
    	let set;
    	let code;
    	let count;
    	let index;
    	let src;
    	let name;
    	let cost;
    	let region;

    	beforeUpdate(() => {
    		set = card.set;
    		code = card.code;
    		$$invalidate(0, count = card.count);
    		index = cardSets[set].findIndex(obj => obj.cardCode == code);
    		$$invalidate(1, src = cardSets[set][index].assets[0].fullAbsolutePath);
    		$$invalidate(1, src = "img/cards/" + code + "-full.png");
    		$$invalidate(2, name = cardSets[set][index].name);
    		$$invalidate(3, cost = cardSets[set][index].cost);
    		$$invalidate(4, region = cardSets[set][index].regionRef);
    	});

    	const writable_props = ["card"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<CardBar> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("CardBar", $$slots, []);

    	$$self.$set = $$props => {
    		if ("card" in $$props) $$invalidate(5, card = $$props.card);
    	};

    	$$self.$capture_state = () => ({
    		cardSets,
    		beforeUpdate,
    		afterUpdate,
    		card,
    		set,
    		code,
    		count,
    		index,
    		src,
    		name,
    		cost,
    		region
    	});

    	$$self.$inject_state = $$props => {
    		if ("card" in $$props) $$invalidate(5, card = $$props.card);
    		if ("set" in $$props) set = $$props.set;
    		if ("code" in $$props) code = $$props.code;
    		if ("count" in $$props) $$invalidate(0, count = $$props.count);
    		if ("index" in $$props) index = $$props.index;
    		if ("src" in $$props) $$invalidate(1, src = $$props.src);
    		if ("name" in $$props) $$invalidate(2, name = $$props.name);
    		if ("cost" in $$props) $$invalidate(3, cost = $$props.cost);
    		if ("region" in $$props) $$invalidate(4, region = $$props.region);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [count, src, name, cost, region, card];
    }

    class CardBar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { card: 5 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CardBar",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*card*/ ctx[5] === undefined && !("card" in props)) {
    			console.warn("<CardBar> was created without expected prop 'card'");
    		}
    	}

    	get card() {
    		throw new Error("<CardBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set card(value) {
    		throw new Error("<CardBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.21.0 */
    const file$1 = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (129:4) {#each heroes as card}
    function create_each_block_2(ctx) {
    	let current;

    	const cardbar = new CardBar({
    			props: { card: /*card*/ ctx[9] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(cardbar.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(cardbar, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const cardbar_changes = {};
    			if (dirty & /*heroes*/ 2) cardbar_changes.card = /*card*/ ctx[9];
    			cardbar.$set(cardbar_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(cardbar.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(cardbar.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(cardbar, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(129:4) {#each heroes as card}",
    		ctx
    	});

    	return block;
    }

    // (139:4) {#each minions as card}
    function create_each_block_1(ctx) {
    	let current;

    	const cardbar = new CardBar({
    			props: { card: /*card*/ ctx[9] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(cardbar.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(cardbar, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const cardbar_changes = {};
    			if (dirty & /*minions*/ 4) cardbar_changes.card = /*card*/ ctx[9];
    			cardbar.$set(cardbar_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(cardbar.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(cardbar.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(cardbar, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(139:4) {#each minions as card}",
    		ctx
    	});

    	return block;
    }

    // (148:4) {#each spells as card}
    function create_each_block(ctx) {
    	let current;

    	const cardbar = new CardBar({
    			props: { card: /*card*/ ctx[9] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(cardbar.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(cardbar, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const cardbar_changes = {};
    			if (dirty & /*spells*/ 8) cardbar_changes.card = /*card*/ ctx[9];
    			cardbar.$set(cardbar_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(cardbar.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(cardbar.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(cardbar, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(148:4) {#each spells as card}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let deckcode_1;
    	let label;
    	let t1;
    	let input;
    	let t2;
    	let main;
    	let div0;
    	let h10;
    	let t3;
    	let count0;
    	let t4_value = /*heroes*/ ctx[1].length + "";
    	let t4;
    	let t5;
    	let t6;
    	let div1;
    	let h11;
    	let t7;
    	let count1;
    	let t8_value = /*minions*/ ctx[2].length + "";
    	let t8;
    	let t9;
    	let t10;
    	let div2;
    	let h12;
    	let t11;
    	let count2;
    	let t12_value = /*spells*/ ctx[3].length + "";
    	let t12;
    	let t13;
    	let t14;
    	let hr;
    	let t15;
    	let footer;
    	let a0;
    	let svg0;
    	let title0;
    	let t16;
    	let path0;
    	let t17;
    	let t18;
    	let a1;
    	let svg1;
    	let title1;
    	let t19;
    	let path1;
    	let t20;
    	let current;
    	let dispose;
    	let each_value_2 = /*heroes*/ ctx[1];
    	validate_each_argument(each_value_2);
    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_2[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	const out = i => transition_out(each_blocks_2[i], 1, 1, () => {
    		each_blocks_2[i] = null;
    	});

    	let each_value_1 = /*minions*/ ctx[2];
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const out_1 = i => transition_out(each_blocks_1[i], 1, 1, () => {
    		each_blocks_1[i] = null;
    	});

    	let each_value = /*spells*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out_2 = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			deckcode_1 = element("deckcode");
    			label = element("label");
    			label.textContent = "牌組代碼";
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			main = element("main");
    			div0 = element("div");
    			h10 = element("h1");
    			t3 = text("英雄:\n      ");
    			count0 = element("count");
    			t4 = text(t4_value);
    			t5 = space();

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t6 = space();
    			div1 = element("div");
    			h11 = element("h1");
    			t7 = text("單位:\n      ");
    			count1 = element("count");
    			t8 = text(t8_value);
    			t9 = space();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t10 = space();
    			div2 = element("div");
    			h12 = element("h1");
    			t11 = text("法術:\n      ");
    			count2 = element("count");
    			t12 = text(t12_value);
    			t13 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t14 = space();
    			hr = element("hr");
    			t15 = space();
    			footer = element("footer");
    			a0 = element("a");
    			svg0 = svg_element("svg");
    			title0 = svg_element("title");
    			t16 = text("Facebook icon");
    			path0 = svg_element("path");
    			t17 = text("\n    符文大地情報站");
    			t18 = space();
    			a1 = element("a");
    			svg1 = svg_element("svg");
    			title1 = svg_element("title");
    			t19 = text("GitHub icon");
    			path1 = svg_element("path");
    			t20 = text("\n    原始碼");
    			attr_dev(label, "class", "svelte-dhmvfu");
    			add_location(label, file$1, 118, 2, 2471);
    			attr_dev(input, "placeholder", "將代碼貼在此");
    			attr_dev(input, "class", "svelte-dhmvfu");
    			add_location(input, file$1, 119, 2, 2493);
    			attr_dev(deckcode_1, "class", "svelte-dhmvfu");
    			add_location(deckcode_1, file$1, 117, 0, 2458);
    			attr_dev(count0, "class", "svelte-dhmvfu");
    			add_location(count0, file$1, 126, 6, 2618);
    			attr_dev(h10, "class", "svelte-dhmvfu");
    			add_location(h10, file$1, 124, 4, 2597);
    			attr_dev(div0, "class", "svelte-dhmvfu");
    			add_location(div0, file$1, 123, 2, 2587);
    			attr_dev(count1, "class", "svelte-dhmvfu");
    			add_location(count1, file$1, 136, 6, 2766);
    			attr_dev(h11, "class", "svelte-dhmvfu");
    			add_location(h11, file$1, 134, 4, 2745);
    			attr_dev(div1, "class", "svelte-dhmvfu");
    			add_location(div1, file$1, 132, 2, 2734);
    			attr_dev(count2, "class", "svelte-dhmvfu");
    			add_location(count2, file$1, 145, 6, 2915);
    			attr_dev(h12, "class", "svelte-dhmvfu");
    			add_location(h12, file$1, 143, 4, 2894);
    			attr_dev(div2, "class", "svelte-dhmvfu");
    			add_location(div2, file$1, 142, 2, 2884);
    			attr_dev(main, "class", "svelte-dhmvfu");
    			add_location(main, file$1, 122, 0, 2578);
    			attr_dev(hr, "class", "svelte-dhmvfu");
    			add_location(hr, file$1, 153, 0, 3038);
    			add_location(title0, file$1, 162, 6, 3223);
    			attr_dev(path0, "d", "M23.9981 11.9991C23.9981 5.37216 18.626 0 11.9991 0C5.37216 0 0\n        5.37216 0 11.9991C0 17.9882 4.38789 22.9522 10.1242\n        23.8524V15.4676H7.07758V11.9991H10.1242V9.35553C10.1242 6.34826 11.9156\n        4.68714 14.6564 4.68714C15.9692 4.68714 17.3424 4.92149 17.3424\n        4.92149V7.87439H15.8294C14.3388 7.87439 13.8739 8.79933 13.8739\n        9.74824V11.9991H17.2018L16.6698 15.4676H13.8739V23.8524C19.6103 22.9522\n        23.9981 17.9882 23.9981 11.9991Z");
    			add_location(path0, file$1, 163, 6, 3258);
    			attr_dev(svg0, "class", "social svelte-dhmvfu");
    			attr_dev(svg0, "role", "img");
    			attr_dev(svg0, "viewBox", "0 0 24 24");
    			attr_dev(svg0, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg0, file$1, 157, 4, 3106);
    			attr_dev(a0, "href", "https://www.facebook.com/LoRFanTW");
    			attr_dev(a0, "class", "svelte-dhmvfu");
    			add_location(a0, file$1, 156, 2, 3057);
    			add_location(title1, file$1, 181, 6, 3962);
    			attr_dev(path1, "d", "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205\n        11.385.6.113.82-.258.82-.577\n        0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07\n        3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838\n        1.236 1.838 1.236 1.07 1.835 2.809 1.305\n        3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93\n        0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322\n        3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552\n        3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23\n        3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015\n        2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24\n        12.297c0-6.627-5.373-12-12-12");
    			add_location(path1, file$1, 182, 6, 3995);
    			attr_dev(svg1, "class", "social svelte-dhmvfu");
    			attr_dev(svg1, "role", "img");
    			attr_dev(svg1, "viewBox", "0 0 24 24");
    			attr_dev(svg1, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg1, file$1, 176, 4, 3845);
    			attr_dev(a1, "href", "https://github.com/jotarun/runeterradeckviewer");
    			attr_dev(a1, "class", "svelte-dhmvfu");
    			add_location(a1, file$1, 175, 2, 3783);
    			attr_dev(footer, "class", "svelte-dhmvfu");
    			add_location(footer, file$1, 155, 0, 3046);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, deckcode_1, anchor);
    			append_dev(deckcode_1, label);
    			append_dev(deckcode_1, t1);
    			append_dev(deckcode_1, input);
    			set_input_value(input, /*deckcode*/ ctx[0]);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, div0);
    			append_dev(div0, h10);
    			append_dev(h10, t3);
    			append_dev(h10, count0);
    			append_dev(count0, t4);
    			append_dev(div0, t5);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].m(div0, null);
    			}

    			append_dev(main, t6);
    			append_dev(main, div1);
    			append_dev(div1, h11);
    			append_dev(h11, t7);
    			append_dev(h11, count1);
    			append_dev(count1, t8);
    			append_dev(div1, t9);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div1, null);
    			}

    			append_dev(main, t10);
    			append_dev(main, div2);
    			append_dev(div2, h12);
    			append_dev(h12, t11);
    			append_dev(h12, count2);
    			append_dev(count2, t12);
    			append_dev(div2, t13);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			insert_dev(target, t14, anchor);
    			insert_dev(target, hr, anchor);
    			insert_dev(target, t15, anchor);
    			insert_dev(target, footer, anchor);
    			append_dev(footer, a0);
    			append_dev(a0, svg0);
    			append_dev(svg0, title0);
    			append_dev(title0, t16);
    			append_dev(svg0, path0);
    			append_dev(a0, t17);
    			append_dev(footer, t18);
    			append_dev(footer, a1);
    			append_dev(a1, svg1);
    			append_dev(svg1, title1);
    			append_dev(title1, t19);
    			append_dev(svg1, path1);
    			append_dev(a1, t20);
    			current = true;
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(input, "change", /*decode*/ ctx[4], false, false, false),
    				listen_dev(input, "input", /*input_input_handler*/ ctx[8])
    			];
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*deckcode*/ 1 && input.value !== /*deckcode*/ ctx[0]) {
    				set_input_value(input, /*deckcode*/ ctx[0]);
    			}

    			if ((!current || dirty & /*heroes*/ 2) && t4_value !== (t4_value = /*heroes*/ ctx[1].length + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*heroes*/ 2) {
    				each_value_2 = /*heroes*/ ctx[1];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_2[i]) {
    						each_blocks_2[i].p(child_ctx, dirty);
    						transition_in(each_blocks_2[i], 1);
    					} else {
    						each_blocks_2[i] = create_each_block_2(child_ctx);
    						each_blocks_2[i].c();
    						transition_in(each_blocks_2[i], 1);
    						each_blocks_2[i].m(div0, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_2.length; i < each_blocks_2.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if ((!current || dirty & /*minions*/ 4) && t8_value !== (t8_value = /*minions*/ ctx[2].length + "")) set_data_dev(t8, t8_value);

    			if (dirty & /*minions*/ 4) {
    				each_value_1 = /*minions*/ ctx[2];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    						transition_in(each_blocks_1[i], 1);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						transition_in(each_blocks_1[i], 1);
    						each_blocks_1[i].m(div1, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks_1.length; i += 1) {
    					out_1(i);
    				}

    				check_outros();
    			}

    			if ((!current || dirty & /*spells*/ 8) && t12_value !== (t12_value = /*spells*/ ctx[3].length + "")) set_data_dev(t12, t12_value);

    			if (dirty & /*spells*/ 8) {
    				each_value = /*spells*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div2, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out_2(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_2.length; i += 1) {
    				transition_in(each_blocks_2[i]);
    			}

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks_1[i]);
    			}

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks_2 = each_blocks_2.filter(Boolean);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				transition_out(each_blocks_2[i]);
    			}

    			each_blocks_1 = each_blocks_1.filter(Boolean);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				transition_out(each_blocks_1[i]);
    			}

    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(deckcode_1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks_2, detaching);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(hr);
    			if (detaching) detach_dev(t15);
    			if (detaching) detach_dev(footer);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function sortdeck(array) {
    	return array.sort(function (a, b) {
    		var x = a.cost;
    		var y = b.cost;
    		return x < y ? -1 : x > y ? 1 : 0;
    	});
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let deckcode = "CEBQCAQDAQCQCBABCETTINQHAEBQEDAPCQPCKKAAAEAQEAYD";
    	let url = window.location.href;
    	let param = lib.parse(url.split("?")[1]);
    	if (param.code) deckcode = param.code;
    	let deck = {};
    	let heroes = {};
    	let minions = {};
    	let spells = {};
    	decode();

    	function decode() {
    		deck = src_1.decode(deckcode);

    		deck.forEach((o, i, a) => {
    			let set = a[i].set;
    			let index = cardSets[set].findIndex(obj => obj.cardCode == a[i].code);
    			a[i].supertype = cardSets[set][index].supertype;
    			a[i].type = cardSets[set][index].type;
    			a[i].cost = cardSets[set][index].cost;
    		});

    		$$invalidate(1, heroes = deck.filter(card => card.supertype == "英雄"));
    		$$invalidate(2, minions = deck.filter(card => card.type == "單位" && card.supertype == ""));
    		$$invalidate(3, spells = deck.filter(card => card.type == "法術"));
    		sortdeck(heroes);
    		sortdeck(minions);
    		sortdeck(spells);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);

    	function input_input_handler() {
    		deckcode = this.value;
    		$$invalidate(0, deckcode);
    	}

    	$$self.$capture_state = () => ({
    		DeckEncoder: src_1,
    		cardSets,
    		qs: lib,
    		CardBar,
    		deckcode,
    		url,
    		param,
    		deck,
    		heroes,
    		minions,
    		spells,
    		decode,
    		sortdeck
    	});

    	$$self.$inject_state = $$props => {
    		if ("deckcode" in $$props) $$invalidate(0, deckcode = $$props.deckcode);
    		if ("url" in $$props) url = $$props.url;
    		if ("param" in $$props) param = $$props.param;
    		if ("deck" in $$props) deck = $$props.deck;
    		if ("heroes" in $$props) $$invalidate(1, heroes = $$props.heroes);
    		if ("minions" in $$props) $$invalidate(2, minions = $$props.minions);
    		if ("spells" in $$props) $$invalidate(3, spells = $$props.spells);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		deckcode,
    		heroes,
    		minions,
    		spells,
    		decode,
    		deck,
    		url,
    		param,
    		input_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    const app = new App({
    	 target: document.body,
    	// props: {
    	// 	name: 'world'
    	// }
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
