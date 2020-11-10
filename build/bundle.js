
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
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
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
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
    function empty() {
        return text('');
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
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
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

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
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
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
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
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
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
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.24.1' }, detail)));
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
        if (text.wholeText === data)
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
        const factionId = Faction.FACTIONS[code];

        if (factionId === undefined) {
          throw new TypeError('Invalid faction code. It is possible you need to upgrade the runeterra package.')
        }

        return new this(code, factionId)
      }

      static fromID (id) {
        const [shortCode, factionId] = Object.entries(Faction.FACTIONS).find(([shortCode, factionId]) => factionId === id) || [];

        if (factionId === undefined) {
          throw new TypeError('Invalid faction id. It is possible you need to upgrade the runeterra package.')
        }

        return new this(shortCode, factionId)
      }
    }

    Faction.FACTIONS = {
      DE: 0,
      FR: 1,
      IO: 2,
      NX: 3,
      PZ: 4,
      SI: 5,
      BW: 6,
      MT: 9
    };

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

    var set3 = [
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03BW006T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW006-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 5,
    		cost: 5,
    		health: 5,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：\r\n在手牌生成1張<link=card.create><style=AssociatedCard>鯊幫制裁</style></link>。",
    		descriptionRaw: "回合開始：\r\n在手牌生成1張鯊幫制裁。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "在擂台上闖蕩多年，讓傑克學到了許多寶貴的經驗。他學到只要對手會流血，就會懂得害怕；他學到冷眼凝視的威力；他也學到了毫無所忌的暴力有多強大。",
    		artistName: "JiHun Lee",
    		name: "優勝者傑克",
    		cardCode: "03BW006",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW010-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "使1個友軍單位<link=keyword.Capture><sprite name=Capture><style=Keyword>俘虜</style></link>另1個友軍單位，並獲得被俘單位的<br>能力值。",
    		descriptionRaw: "使1個友軍單位俘虜另1個友軍單位，並獲得被俘單位的能力值。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「進來吧，朋友，那麼你想要的東西將永遠屬於你。」——貪啃奇",
    		artistName: "Kudos Productions",
    		name: "河流饗宴",
    		cardCode: "03BW010",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW005-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "將1個單位或地標洗入其牌組。",
    		descriptionRaw: "將1個單位或地標洗入其牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「聽著，朋友，我給了你想要的東西，但我從沒說過那是永久的。」——貪啃奇",
    		artistName: "Kudos Productions",
    		name: "沉沒代價",
    		cardCode: "03BW005",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03BW004T4",
    			"03BW004T3",
    			"03BW004T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW004-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 4,
    		health: 6,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：\r\n在手牌生成1張<link=card.create><style=AssociatedCard>品味獨到</style></link>。",
    		descriptionRaw: "回合開始：\r\n在手牌生成1張品味獨到。",
    		levelupDescription: "此牌<link=keyword.Capture><sprite name=Capture><style=Keyword>俘虜</style></link>3個或以上單位<style=Variable></style>。此牌升級時，<link=keyword.Obliterate><style=Keyword>泯滅</style></link>被此牌<link=keyword.Capture><sprite name=Capture><style=Keyword>俘虜</style></link>的敵軍單位，若為友軍單位則將其釋放。",
    		levelupDescriptionRaw: "此牌俘虜3個或以上單位。此牌升級時，泯滅被此牌俘虜的敵軍單位，若為友軍單位則將其釋放。",
    		flavorText: "「朋友，我知道那個表情。我看得出來，你覺得自己滿手爛牌。你想要更棒的對吧？我或許能滿足你的渴望，讓你品嚐最想要的東西。只需在這紙上簽名……而你，我的朋友，你的生命就會得到滿足。」",
    		artistName: "SIXMOREVODKA",
    		name: "貪啃奇",
    		cardCode: "03BW004",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03BW004T3",
    			"03BW004"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW004T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW004T2-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "<link=card.level1><style=AssociatedCard>貪啃奇</style></link>吞噬1個敵軍單位。使該單位<link=vocab.Strike><style=Vocab>打擊</style></link>貪啃奇，接著貪啃奇<link=keyword.Capture><sprite name=Capture><style=Keyword>俘虜</style></link>該單位。",
    		descriptionRaw: "貪啃奇吞噬1個敵軍單位。使該單位打擊貪啃奇，接著貪啃奇俘虜該單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你本可無事一身輕的，但卻蠢到接受我的<br>提議……」——貪啃奇",
    		artistName: "Kudos Productions",
    		name: "品味獨到",
    		cardCode: "03BW004T2",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03BW004T4",
    			"03BW004",
    			"03BW004T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW004T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW004T3-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 4,
    		health: 7,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：<br>在手牌生成1張<link=card.create><style=AssociatedCard>品味獨到</style></link>。\r\n<link=vocab.Attack><style=Vocab>攻擊</style></link>：<link=keyword.Obliterate><style=Keyword>泯滅</style></link>被此牌<link=keyword.Capture><sprite name=Capture><style=Keyword>俘虜</style></link>的敵軍單位，若為友軍單位則將其釋放。",
    		descriptionRaw: "回合開始：在手牌生成1張品味獨到。\r\n攻擊：泯滅被此牌俘虜的敵軍單位，若為友軍單位則將其釋放。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「成交，我的朋友，雖然你一定能從中撈到好處，不過記住……凡事都有代價，我只是還沒跟你收取<br>而已。」",
    		artistName: "SIXMOREVODKA",
    		name: "貪啃奇",
    		cardCode: "03BW004T3",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03BW004",
    			"03BW004T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW004T4.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW004T4-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "使1個友軍單位<link=keyword.Capture><sprite name=Capture><style=Keyword>俘虜</style></link>另1個友軍單位，並獲得被俘單位的能力值。\r\n將1張<link=card.level1><style=AssociatedCard>貪啃奇</style></link>洗入牌組。",
    		descriptionRaw: "使1個友軍單位俘虜另1個友軍單位，並獲得被俘單位的能力值。\r\n將1張貪啃奇洗入牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「進來吧，朋友，那麼你想要的東西將永遠屬於你。」——貪啃奇",
    		artistName: "Kudos Productions",
    		name: "貪啃奇 河流饗宴",
    		cardCode: "03BW004T4",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW002-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 3,
    		health: 5,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：對此牌造成2點傷害。",
    		descriptionRaw: "回合開始：對此牌造成2點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「唉，人們就是蠢！只要有冰涼的飲料跟溫暖舒適的椅子，他們就會把各式各樣的秘密告訴貌似善良的人。你說，還有誰的臉比年輕的李奧納德看起來更友善呢？」——蟾蜍算命師",
    		artistName: "Grafit Studio",
    		name: "貴公子蜥蜴",
    		cardCode: "03BW002",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW034T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW014-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "召喚1個<link=card.summon><style=AssociatedCard>火藥猴群</style></link>。\r\n<link=vocab.Plunder><style=Vocab>洗劫</style></link>：下次<link=vocab.RoundStart><style=Vocab>回合開始</style></link>再召喚1個。",
    		descriptionRaw: "召喚1個火藥猴群。\r\n洗劫：下次回合開始再召喚1個。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「哎喲，你看牠們一副天真可愛的樣子？才怪！牠們會到處搗亂，比暈船的嚮導還槽糕，而且一直吵個不停！猴子不准上船，這是規矩！」——肖狗水手",
    		artistName: "Kudos Productions",
    		name: "耍猴戲",
    		cardCode: "03BW014",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW007-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 2,
    		health: 4,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：對此牌造成3點傷害。",
    		descriptionRaw: "出牌：對此牌造成3點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「當然，帕布羅的確是遇上了小低潮，而且也吃了不少拳頭……不過你知道嗎？這兒真還沒有其他人能用八拳流打遍天下無敵手的。」——奸巧魚老大",
    		artistName: "Grafit Studio",
    		name: "章魚拳師",
    		cardCode: "03BW007",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW006T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW006T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對1個友軍單位造成2點傷害，然後對敵方主堡造成2點傷害。",
    		descriptionRaw: "對1個友軍單位造成2點傷害，然後對敵方主堡造成2點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「讓他們沾滿你的血，然後放鯊魚咬人。」<br>——優勝者傑克",
    		artistName: "Kudos Productions",
    		name: "鯊幫制裁",
    		cardCode: "03BW006T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW001-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：<link=vocab.Toss><style=Vocab>亂擲</style></link>1張牌。若我方已<link=keyword.Deep><sprite name=Deep><style=Keyword>探底</style></link>，則摧毀此牌以隨機召喚1個海怪單位。<style=Variable></style>",
    		descriptionRaw: "回合開始：亂擲1張牌。若我方已探底，則摧毀此牌以隨機召喚1個海怪單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "每天當地居民都會在殘惡碼頭流連，想一探比爾吉沃特的水手們，從深淵中把什麼樣的怪物捕了上來。那些海怪們通常都已經死了……嗯，通常啦。",
    		artistName: "SIXMOREVODKA",
    		name: "殘惡碼頭",
    		cardCode: "03BW001",
    		keywords: [
    			"地標"
    		],
    		keywordRefs: [
    			"LandmarkVisualOnly"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "地標",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW015.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW015-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 1,
    		health: 4,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：對此牌造成2點傷害。",
    		descriptionRaw: "出牌：對此牌造成2點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「還不敲鐘開打？我要讓那個帶刺的老傢伙見識見識我的眾多名號是怎麼來的，沒錯，他們叫我『八拳帕布羅』、『大猛海怪』，還有『駭人觸手』！這場打完絕對讓你夾著螫針哭著回家叫媽媽！」<br>——章魚拳師",
    		artistName: "SIXMOREVODKA",
    		name: "硬脾氣老蠍",
    		cardCode: "03BW015",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW003-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 6,
    		health: 8,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：對所有其他友軍單位造成1點傷害，且每傷害1個友軍單位，便賦予此牌+1|+0。",
    		descriptionRaw: "出牌：對所有其他友軍單位造成1點傷害，且每傷害1個友軍單位，便賦予此牌+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "奪權的過程通常都會發生暴力事件……但通常不會這麼隨便。",
    		artistName: "Grafit Studio",
    		name: "奸巧魚老大",
    		cardCode: "03BW003",
    		keywords: [
    			"勢不可擋",
    			"弱勢"
    		],
    		keywordRefs: [
    			"Overwhelm",
    			"Vulnerable"
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW008-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：對此牌和1個友軍單位造成1點傷害以抽1張牌。",
    		descriptionRaw: "出牌：對此牌和1個友軍單位造成1點傷害以抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「老芭布斯出過一些事。她年輕時殺了幾個當地人，不過我想這讓她建立了一些口碑。」——貴公子蜥蜴",
    		artistName: "Grafit Studio",
    		name: "蟾蜍算命師",
    		cardCode: "03BW008",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03BW009-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "對1個友軍單位造成2點傷害以賦予2個敵軍單位<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>。",
    		descriptionRaw: "對1個友軍單位造成2點傷害以賦予2個敵軍單位弱勢。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「嫩咖，要告訴我你是從哪搞來那些『額外的桶子』嗎？嗯？不然我們可以讓你的舌頭和勁波的手臂來場拔河比賽。兄弟……我可不會賭你贏。」<br>——奸巧魚老大",
    		artistName: "Kudos Productions",
    		name: "勒索",
    		cardCode: "03BW009",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03PZ019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03PZ019-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "在手牌中時，此牌會擁有1個隨機特性（每回合會改變）。召喚此牌時，賦予此牌該特性。",
    		descriptionRaw: "在手牌中時，此牌會擁有1個隨機特性（每回合會改變）。召喚此牌時，賦予此牌該特性。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "雖然不像真的那樣蓬軟好抱，但就像真的一樣可愛。",
    		artistName: "Dao Le",
    		name: "拼裝普羅機器人",
    		cardCode: "03PZ019",
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
    			"普羅"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03PZ022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03PZ022-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "將所有友軍單位的力量和生命值，提升成友軍單位中力量或生命值最高的數值。\r\n賦予所有友軍單位其他友軍單位的特性。",
    		descriptionRaw: "將所有友軍單位的力量和生命值，提升成友軍單位中力量或生命值最高的數值。\r\n賦予所有友軍單位其他友軍單位的特性。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "\"I know I know\nYou want some more\nIf you ready let's go\nGiving it all\"\n「我懂我懂\n你想要更多\n準備好就一起走\n拼上全力不放手」\n——瑟菈紛〈MORE〉",
    		artistName: "Kudos Productions",
    		name: "全力以赴",
    		cardCode: "03PZ022",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03PZ017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03PZ017-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "對1個單位造成1點傷害。隨機召喚1個魔耗值<style=Variable>1</style>的侍從單位。此牌在手中時，每當我方打出1張魔耗值3點的卡牌，則造成的傷害值與召喚單位魔耗值皆增加1點。",
    		descriptionRaw: "對1個單位造成1點傷害。隨機召喚1個魔耗值1的侍從單位。此牌在手中時，每當我方打出1張魔耗值3點的卡牌，則造成的傷害值與召喚單位魔耗值皆增加1點。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「……一、二、三！！！噢。噢，我的天啊……又是無法預料的結果？！」——漢默丁格",
    		artistName: "Kudos Productions",
    		name: "三雷射爆破炮",
    		cardCode: "03PZ017",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ020"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03PZ018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03PZ018-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "棄置1張牌即可出此牌。\r\n在手牌生成2張<link=card.create><style=AssociatedCard>大膽普羅</style></link>。",
    		descriptionRaw: "棄置1張牌即可出此牌。\r\n在手牌生成2張大膽普羅。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "兩個毛茸茸的身影從熱情的群眾頭上劃過天際，在身後留下一團絨毛和淡淡的烘焙香",
    		artistName: "Kudos Productions",
    		name: "普羅大砲",
    		cardCode: "03PZ018",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI004-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "從我方牌組最上方4張牌選1個侍從單位。\r\n抽出該牌、在手牌生成1張與該牌完全相同的<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>複製牌，並將其餘卡牌洗回我方牌組。",
    		descriptionRaw: "從我方牌組最上方4張牌選1個侍從單位。\r\n抽出該牌、在手牌生成1張與該牌完全相同的閃靈複製牌，並將其餘卡牌洗回我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「去……包圍他們……」——夜曲",
    		artistName: "Kudos Productions",
    		name: "如影隨形",
    		cardCode: "03SI004",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI012-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "<link=keyword.Obliterate><style=Keyword>泯滅</style></link>本回合所有被召喚但並非打出的單位。",
    		descriptionRaw: "泯滅本回合所有被召喚但並非打出的單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「當然，死亡也存在於蒂瑪西亞。我們看著它帶走所愛之人，也知道總有一天會輪到我們。但在這些島嶼上……我幾乎能嘗到死亡的味道。死亡的氣息充滿我的肺臟，我甚至能聽到它的耳語。這不是什麼抽象的概念，它此時此刻就坐在我身旁，沒有任何人逃得出它的魔掌。」\n——歷史學家延斯．托曼的筆記",
    		artistName: "Kudos Productions",
    		name: "暗路難行",
    		cardCode: "03SI012",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI014-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "賦予牌組與手牌中的所有友軍單位+2|+2與<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。",
    		descriptionRaw: "賦予牌組與手牌中的所有友軍單位+2|+2與閃靈。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我擔心闇影島的夢魘遲早會讓所有人的身心靈崩潰，只剩下無止盡的瘋狂。」\n——歷史學家延斯．托曼的筆記",
    		artistName: "Kudos Productions",
    		name: "幽侵狂影",
    		cardCode: "03SI014",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03SI016T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI016-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "從1個單位<link=keyword.Drain><style=Keyword>汲取</style></link>1點生命值，<br>並將2張此牌的複製卡牌洗入我方牌組。<br>施放此牌<style=Variable>3</style>次後，<br>將<link=vocab.Everywhere><style=Vocab>各處</style></link>此牌的相同卡牌幻化為<link=card.transform><style=AssociatedCard>做好準備</style></link>。<style=Variable></style>",
    		descriptionRaw: "從1個單位汲取1點生命值，並將2張此牌的複製卡牌洗入我方牌組。施放此牌3次後，將各處此牌的相同卡牌幻化為做好準備。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "\"We go hard, 'til we get it, get it\nWe go hard, we so in it, in it\nWe Pop Stars (Pop Stars), only winning, winning now\nAin't nobody bringing us down, down, down, down\"\n「使盡全力直至夢想到手\n使盡全力直到渾然忘我\n我們是Pop Stars 眼中只有勝利\n無人能敵」\n——伊芙琳〈POP/STARS〉",
    		artistName: "Kudos Productions",
    		name: "使盡全力",
    		cardCode: "03SI016",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03SI016"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI016T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI016T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "對所有敵軍單位和敵方主堡造成5點傷害。將<link=vocab.Everywhere><style=Vocab>各處</style></link>此牌的相同卡牌幻化為<link=card.transform><style=AssociatedCard>使盡全力</style></link>。",
    		descriptionRaw: "對所有敵軍單位和敵方主堡造成5點傷害。將各處此牌的相同卡牌幻化為使盡全力。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "\"Sorry for the bad news sorry I'm so bad\nOnly took a minute for me to get all you had\nSorry for the bad news know it makes you sad\nI'll be here for a minute baby you should pack your bags\"\n「非常抱歉我這人非常糟\n瞬間就奪走你一切轉眼就跑\n非常抱歉你今天心情必定很糟\n寶貝快做好準備因為我馬上就到」\n——伊芙琳〈THE BADDEST〉",
    		artistName: "Kudos Productions",
    		name: "做好準備",
    		cardCode: "03SI016T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI007-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "我方下次於本回合召喚1個友軍單位時，本回合給予該單位+1|+0與<link=keyword.SpellShield><sprite name=SpellShield><style=Keyword>法盾</style></link>。",
    		descriptionRaw: "我方下次於本回合召喚1個友軍單位時，本回合給予該單位+1|+0與法盾。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你一踏出去，就會感覺到他們，好像指尖拂過頸背，輕如雨水。就算作勢攻擊他們，那些怪物也不會退縮。他們既不怕刀，也不怕火，天不怕地不怕，實在是太恐怖了。」——鯨牙酒吧掠奪者",
    		artistName: "Kudos Productions",
    		name: "夜幕庇護",
    		cardCode: "03SI007",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI014"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI013.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI013-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "召喚1個<link=card.summon><style=AssociatedCard>霧魅</style></link>。",
    		descriptionRaw: "召喚1個霧魅。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "霧魅在凡人看不見的空間中移動，毫無預警地出現，並折磨眼前所見的一切。",
    		artistName: "Kudos Productions",
    		name: "鬼魅夜襲",
    		cardCode: "03SI013",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03SI005T3",
    			"03SI005T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI005-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 5,
    		cost: 4,
    		health: 3,
    		description: "<link=keyword.Nightfall><style=Keyword>夜臨</style></link>：賦予1個敵軍單位<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>，且本回合給予所有敵軍單位<nobr>-1|-0</nobr>。",
    		descriptionRaw: "夜臨：賦予1個敵軍單位弱勢，且本回合給予所有敵軍單位-1|-0。",
    		levelupDescription: "我方以5個或以上<br><link=keyword.Nightfall><style=Keyword>夜臨</style></link>友軍單位攻擊<style=Variable></style>。",
    		levelupDescriptionRaw: "我方以5個或以上夜臨友軍單位攻擊。",
    		flavorText: "「看來，一旦驚動太多靈魂，牠就會入侵我們的世界。只有希望才能把怪物送回原本的世界……但希望早已隨著皇后的最後一口氣，以及國王無盡的痛苦哀號，永遠消逝了。」\n——歷史學家延斯．托曼的筆記",
    		artistName: "SIXMOREVODKA",
    		name: "夜曲",
    		cardCode: "03SI005",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03SI005",
    			"03SI005T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI005T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI005T3-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "從任1目標汲取1點生命值。\r\n將1張<link=card.level1><style=AssociatedCard>夜曲</style></link>洗入我方牌組。\r\n<link=keyword.Nightfall><style=Keyword>夜臨</style></link>：在手牌隨機生成1張\r\n英雄牌以外的<link=keyword.Nightfall><style=Keyword>夜臨</style></link>牌。",
    		descriptionRaw: "從任1目標汲取1點生命值。\r\n將1張夜曲洗入我方牌組。\r\n夜臨：在手牌隨機生成1張\r\n英雄牌以外的夜臨牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「隨著時間過去，我的精神，以及當初驅使我找到這裡的幹勁都逐漸被消磨殆盡。鯨牙酒吧的人個個形容枯槁，似乎已放棄做任何努力，我怕我在這裡待越久，就會變得越來越像他們。」\n——歷史學家延斯．托曼的筆記",
    		artistName: "Kudos Productions",
    		name: "夜曲 深宵斷魂",
    		cardCode: "03SI005T3",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03SI005T3",
    			"03SI005"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI005T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI005T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 6,
    		cost: 4,
    		health: 4,
    		description: "使所有其他友軍單位擁有<link=keyword.Fearsome><sprite name=Fearsome><style=Keyword>威嚇</style></link>。\r\n我方每打出1個單位，本回合即給予所有敵軍單位<nobr>-1|-0</nobr>。",
    		descriptionRaw: "使所有其他友軍單位擁有威嚇。\r\n我方每打出1個單位，本回合即給予所有敵軍單位-1|-0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我的夢境每晚都會變得更加鮮明。我看見一個怪物在黑暗中扭動，步步逼近，簡直是純粹邪惡的化身。雖然我原本應該再多待一週，但我已經買了傍晚去弗斯巴洛的票。說白了，我就是受不了這地方。」\n——歷史學家延斯．托曼的筆記",
    		artistName: "SIXMOREVODKA",
    		name: "夜曲",
    		cardCode: "03SI005T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03SI006T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI006-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword></style></link><link=keyword.Nightfall><style=Keyword>夜臨</style></link>：<br>從敵方主堡汲取2點生命值。",
    		descriptionRaw: "夜臨：從敵方主堡汲取2點生命值。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "每晚，旅人只感到更加疲憊。他們在睡夢中不得安寧，惡夢與現實的分界變得模糊。睡眠不再是一種休息，反而像是在一點一點吸取他們的生命。",
    		artistName: "SIXMOREVODKA",
    		name: "末日豹",
    		cardCode: "03SI006",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI006T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI006T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "從敵方主堡汲取2點生命值。",
    		descriptionRaw: "從敵方主堡汲取2點生命值。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "誰比你更了解自己呢？最能折磨人心的，莫過於自己的夢魘。",
    		artistName: "Kudos Productions",
    		name: "殘酷折磨",
    		cardCode: "03SI006T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI003-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "<link=keyword.Nightfall><style=Keyword>夜臨</style></link>：本回合給予此牌+2|+0與<link=keyword.Fearsome><sprite name=Fearsome><style=Keyword>威嚇</style></link>。",
    		descriptionRaw: "夜臨：本回合給予此牌+2|+0與威嚇。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "當太陽沒入地平線，此地的駭人之物便會甦醒，開始虎視眈眈，等待獵物上鉤。",
    		artistName: "SIXMOREVODKA",
    		name: "冥鬼梟",
    		cardCode: "03SI003",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI002-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "從任1目標汲取1點生命值。\r\n<link=keyword.Nightfall><style=Keyword>夜臨</style></link>：在手牌隨機生成1張\r\n英雄牌以外的<link=keyword.Nightfall><style=Keyword>夜臨</style></link>牌。",
    		descriptionRaw: "從任1目標汲取1點生命值。\r\n夜臨：在手牌隨機生成1張\r\n英雄牌以外的夜臨牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「隨著時間過去，我的精神，以及當初驅使我找到這裡的幹勁都逐漸被消磨殆盡。鯨牙酒吧的人個個形容枯槁，似乎已放棄做任何努力，我怕我在這裡待越久，就會變得越來越像他們。」\n——歷史學家延斯．托曼的筆記",
    		artistName: "Kudos Productions",
    		name: "深宵斷魂",
    		cardCode: "03SI002",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI010-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 5,
    		health: 5,
    		description: "<link=keyword.Nightfall><style=Keyword>夜臨</style></link>：本牌局我方每發動1次<link=keyword.Nightfall><style=Keyword>夜臨</style></link>，則賦予此牌+1|+0。<style=Variable></style>",
    		descriptionRaw: "夜臨：本牌局我方每發動1次夜臨，則賦予此牌+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "每當夕陽西下，夜晚就會張開漆黑的翅膀，抹去白天最後一絲希望。",
    		artistName: "SIXMOREVODKA",
    		name: "夢魘馬",
    		cardCode: "03SI010",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT015.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT015-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "<link=keyword.Invoke><sprite name=Invoke><style=Keyword>祈願</style></link>。",
    		descriptionRaw: "祈願。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "璀璨繁星高掛天上，替遼闊夜空綴滿點點星光。與廣大無邊的天空比起來，你是那麼的渺小。你會首先望向哪處呢？",
    		artistName: "Kudos Productions",
    		name: "望穿無垠",
    		cardCode: "03MT015",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT018-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，抽1張牌。",
    		descriptionRaw: "召喚此牌時，抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「當貧瘠的樹枝開始長出葉子時，萌春女神便打發信使到凜冬領主，宣告季節的變化。信使的咆哮驚動繁星，物換星移，而他的忠心則為大地帶來溫暖。」\n——《四季之歌》",
    		artistName: "Kudos Productions",
    		name: "靈犬座",
    		cardCode: "03MT018",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT034.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT034-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 2,
    		cost: 0,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「在巨石峰首次經歷分點的時候，巨石峰的居民也首次嘗試停戰。不過，正當各方領袖放下武器的那一刻，突然其中一人痛苦大叫！士兵紛紛拿起長槍，短暫的講和美夢就這樣破碎了。他們怎麼想也想不到，真正的行兇者，竟然是腳下的一條蛇。因此，蛇便成為了亂世的象徵。」\n——巨石峰鄉野雜談",
    		artistName: "Kudos Productions",
    		name: "巨蛇座",
    		cardCode: "03MT034",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT083.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT083-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 6,
    		cost: 8,
    		health: 5,
    		description: "召喚此牌時，本牌局我方每打出1張天界牌，則賦予此牌+1|+0。<style=Variable></style>\r\n此牌首次將要陣亡時，<br>將其完全治癒。",
    		descriptionRaw: "召喚此牌時，本牌局我方每打出1張天界牌，則賦予此牌+1|+0。\r\n此牌首次將要陣亡時，將其完全治癒。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「數個世紀以來，不死鳥獨自翱翔天際，直到有一天，她看到了一隻幼鳥，牠和她一樣，擁有火焰般的金色翅膀。不死鳥欣喜若狂，這是她第一次看到與自己如此相似的存在。然而，數年過去了，幼鳥老了，生命之火最終也熄滅了。不死鳥終於知道死亡為何物，因此悲痛欲絕。她喟然而嘆，眼淚化為火花，直到自己被火焰吞噬。最後她浴火重生，身體煥然一新，但她不再無知。」——蘇瑞瑪鄉野雜談",
    		artistName: "Kudos Productions",
    		name: "不死鳥座",
    		cardCode: "03MT083",
    		keywords: [
    			"隱密",
    			"遺願"
    		],
    		keywordRefs: [
    			"Elusive",
    			"LastBreath"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT004-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "使手牌中1張卡牌的魔耗值-1。",
    		descriptionRaw: "使手牌中1張卡牌的魔耗值-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「滿月銀光普照世界，揭示未行之路，未說之事。」——月環女祭司",
    		artistName: "Kudos Productions",
    		name: "月之銀",
    		cardCode: "03MT004",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT037.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT037-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 10,
    		cost: 10,
    		health: 10,
    		description: "召喚此牌時，本牌局我方每打出1張天界牌，則賦予此牌+1|+0。<style=Variable></style>\r\n<link=vocab.Attack><style=Vocab>攻擊</style></link>：本回合給予所有其他友軍單位+2|+2與<link=keyword.Overwhelm><sprite name=Overwhelm><style=Keyword>勢不可擋</style></link>。",
    		descriptionRaw: "召喚此牌時，本牌局我方每打出1張天界牌，則賦予此牌+1|+0。\r\n攻擊：本回合給予所有其他友軍單位+2|+2與勢不可擋。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "傳說天界的極遠邊陲潛伏著一隻災星怪獸，靜等著末日之時。那時它便會掌控繁星的力量，<br>粉碎世界的根基。",
    		artistName: "Kudos Productions",
    		name: "災厄座",
    		cardCode: "03MT037",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT059T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT059.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT059-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 4,
    		cost: 6,
    		health: 3,
    		description: "召喚此牌時，也召喚<link=card.create><style=AssociatedCard>銀月姊妹座</style></link>。",
    		descriptionRaw: "召喚此牌時，也召喚銀月姊妹座。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「兩個星靈\n從天而降：\n一個身披銀色月光，\n另一個身穿金色火焰……」\n——〈時光頌歌〉",
    		artistName: "Kudos Productions",
    		name: "金陽姊妹座",
    		cardCode: "03MT059",
    		keywords: [
    			"吸血"
    		],
    		keywordRefs: [
    			"Lifesteal"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT053.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT053-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "賦予1個友軍單位+0|+2<br>與<link=keyword.SpellShield><sprite name=SpellShield><style=Keyword>法盾</style></link>。",
    		descriptionRaw: "賦予1個友軍單位+0|+2與法盾。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「沐浴在她柔和的光芒下，接受她的祝福吧。」——月環女祭司",
    		artistName: "Kudos Productions",
    		name: "月之華",
    		cardCode: "03MT053",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT032.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT032-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "抽1張英雄牌，使其魔耗值-1，並賦予其+2|+2。",
    		descriptionRaw: "抽1張英雄牌，使其魔耗值-1，並賦予其+2|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「浩瀚無垠的夜空展現了人間與天界的無際鴻溝。但有些凡人力求成就崇高的目標，如果能受到群峰認可，他們就能升天化作繁星。」——群峰占術師",
    		artistName: "Kudos Productions",
    		name: "繁星密語",
    		cardCode: "03MT032",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT024.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT024-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 9,
    		health: 0,
    		description: "若我方<link=vocab.Behold><style=Vocab>掌控</style></link>天界牌，\r\n則<link=keyword.Obliterate><style=Keyword>泯滅</style></link>2個敵軍單位或地標。",
    		descriptionRaw: "若我方掌控天界牌，\r\n則泯滅2個敵軍單位或地標。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "恒星死亡時會產生非比尋常的爆炸，發出的光芒就連活著的恆星也能遮蓋。  ",
    		artistName: "Kudos Productions",
    		name: "超新星",
    		cardCode: "03MT024",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT066.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT066-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "若我方<link=vocab.Behold><style=Vocab>掌控</style></link>天界牌，則賦予<link=vocab.Everywhere><style=Vocab>各處</style></link>友軍單位+2|+2。",
    		descriptionRaw: "若我方掌控天界牌，則賦予各處友軍單位+2|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「仰望夜空，讓耀眼的繁星映入眼簾，並讓它們的治癒之光充盈全身。」——索拉卡",
    		artistName: "Kudos Productions",
    		name: "宇宙星啟",
    		cardCode: "03MT066",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT077.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT077-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 10,
    		health: 0,
    		description: "將我方手牌補滿\r\n隨機<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>天界牌。\r\n恢復我方所有魔力。",
    		descriptionRaw: "將我方手牌補滿\r\n隨機飛逝天界牌。\r\n恢復我方所有魔力。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「據說有些星座是由凡人所幻化，他們的非凡事蹟使其在星空中獲得一席之地。」——群峰占術師",
    		artistName: "Kudos Productions",
    		name: "降世神話",
    		cardCode: "03MT077",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT010-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 7,
    		cost: 7,
    		health: 7,
    		description: "召喚此牌時，本牌局我方每打出1張天界牌，則賦予此牌+1|+0。<style=Variable></style>",
    		descriptionRaw: "召喚此牌時，本牌局我方每打出1張天界牌，則賦予此牌+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「為了維護天空與大地之間的虛無，一個帶角守護者被放置在山頂上空的繁星之間。健壯又敏捷的牠每晚橫跨夜空尋找入侵者，驅逐它們時發生的衝擊強得令天空與大地震動。」——《牛頭族歷史》",
    		artistName: "Kudos Productions",
    		name: "魔犀座",
    		cardCode: "03MT010",
    		keywords: [
    			"勢不可擋",
    			"法盾"
    		],
    		keywordRefs: [
    			"Overwhelm",
    			"SpellShield"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT070.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT070-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 3,
    		cost: 4,
    		health: 4,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<link=keyword.Invoke><sprite name=Invoke><style=Keyword>祈願</style></link>。",
    		descriptionRaw: "出牌：祈願。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們並無不同，只是被高山、旅途和滿天繁星所分隔罷了。」",
    		artistName: "Kudos Productions",
    		name: "旅人座",
    		cardCode: "03MT070",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT049.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT049-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "對2個敵軍單位依序造成4點與1點傷害。",
    		descriptionRaw: "對2個敵軍單位依序造成4點與1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「不幸地，塑星過程往往混亂難測，那些小岩石的降落地點無人能知。如果它們掉在你的頭上，把你無情地壓死，我只能獻上真摯的道歉。」——翱銳龍獸",
    		artistName: "Kudos Productions",
    		name: "流星雨",
    		cardCode: "03MT049",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT043.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT043-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "<link=keyword.Obliterate><style=Keyword>泯滅</style></link>1個敵軍單位或地標。",
    		descriptionRaw: "泯滅1個敵軍單位或地標。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我會讓繁星穿越這個令人難以忍受的地方，那個場面一定會盛大壯觀。」——翱銳龍獸",
    		artistName: "Kudos Productions",
    		name: "彗星墜擊",
    		cardCode: "03MT043",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT022-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 8,
    		cost: 9,
    		health: 8,
    		description: "召喚此牌時，本牌局我方每打出1張天界牌，則賦予此牌+1|+0。<style=Variable></style>\r\n此牌為龍族牌。",
    		descriptionRaw: "召喚此牌時，本牌局我方每打出1張天界牌，則賦予此牌+1|+0。\r\n此牌為龍族牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「啊，我最喜歡的星座。我總想著它會率先落在這個杳無人煙的山上。」——翱銳龍獸",
    		artistName: "Kudos Productions",
    		name: "彼界龍座",
    		cardCode: "03MT022",
    		keywords: [
    			"隱密",
    			"血怒",
    			"法盾"
    		],
    		keywordRefs: [
    			"Elusive",
    			"Fury",
    			"SpellShield"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "天界",
    		subtypes: [
    			"天界",
    			"龍族"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT078.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT078-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "若我方<link=vocab.Behold><style=Vocab>掌控</style></link>天界牌，則<link=keyword.Obliterate><style=Keyword>泯滅</style></link>所有力量值3點或以下的敵軍單位。",
    		descriptionRaw: "若我方掌控天界牌，則泯滅所有力量值3點或以下的敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "在最初的黑暗中，生命的火花在宇宙中擴散開來。我們永遠不會知道它發出了什麼樣的聲音，散發什麼樣的光芒，因為當時文字仍未誕生，也沒人能見證生命的起源。 ",
    		artistName: "Kudos Productions",
    		name: "宇宙輻爆",
    		cardCode: "03MT078",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT065.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT065-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "<link=vocab.Silence><style=Vocab>沉默</style></link>1個侍從單位。",
    		descriptionRaw: "沉默1個侍從單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "星星之間的空間，只有絕對的沉默。",
    		artistName: "Max Grecke",
    		name: "寂靜星河",
    		cardCode: "03MT065",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT050.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT050-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 5,
    		cost: 5,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "據說夜空中最強熾的星星屬於戰神座，這個看似不朽的古老存在下凡展現驍勇善戰之姿。他戰無不勝，然而故事總有結束的一天，星辰也必有消殞的一日。",
    		artistName: "Kudos Productions",
    		name: "戰神座",
    		cardCode: "03MT050",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT011-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>2個敵軍單位。",
    		descriptionRaw: "擊暈2個敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「月光也能耀眼奪目。」——黛安娜",
    		artistName: "Kudos Productions",
    		name: "月牙衝擊",
    		cardCode: "03MT011",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "法術",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT095.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT095-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「有一天，我像往常一樣做生意，結果有個看起來很有錢的公子哥大搖大擺走了進來。肯定很好騙，對吧？於是我用花言巧語，騙他以高價買下商品。直到我把金幣收起來，才發現那混帳小子竟然偷了我的錢再付給我！我告訴你，那晚的狡鼬座肯定特別明亮。」——約德爾騙子",
    		artistName: "Kudos Productions",
    		name: "狡鼬座",
    		cardCode: "03MT095",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT059"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT059T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT059T1-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 4,
    		cost: 6,
    		health: 3,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「……儘管兩者皆由宇宙光所組成，\n雙方仍勢不兩立，因為她們實在太相似了。\n因此她們將白晝與黑夜區分開來，\n彼此都能隨心所欲、互不干涉……」\n——〈時光頌歌〉",
    		artistName: "Kudos Productions",
    		name: "銀月姊妹座",
    		cardCode: "03MT059T1",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT090.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT090-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 4,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「在太陽底下，他的角金光閃閃，胸中燃起熊熊烈火。讓我們用盾牌重擊地面，如他的重蹄一般響徹雲霄！」——日輪戰前祈禱",
    		artistName: "Kudos Productions",
    		name: "戰牛座",
    		cardCode: "03MT090",
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
    		subtype: "天界",
    		subtypes: [
    			"天界"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT073T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT073.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT073-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "召喚此牌時，<br>在手牌生成1張<link=card.create><style=AssociatedCard>暮花之塵</style></link>。",
    		descriptionRaw: "召喚此牌時，在手牌生成1張暮花之塵。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「暮花只在滿月時綻放，是月環教引以為傲的象徵。我們使用暮花之塵已有數百年歷史，只有我們知道正確的採集方式。」",
    		artistName: "JiHun Lee",
    		name: "月環喚暮者",
    		cardCode: "03MT073",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT073T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT073T1-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "本回合我方打出的下一個<link=keyword.Nightfall><style=Keyword>夜臨</style></link>單位魔耗值-1。",
    		descriptionRaw: "本回合我方打出的下一個夜臨單位魔耗值-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "暮花的芬芳是無可比擬的。它散發奇特的芳香，卻稍縱即逝，如月光般纖弱。",
    		artistName: "Kudos Productions",
    		name: "暮花之塵",
    		cardCode: "03MT073T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT001T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT001-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 3,
    		cost: 5,
    		health: 3,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>力量值2點或以下的所有敵軍單位。",
    		descriptionRaw: "出牌：擊暈力量值2點或以下的所有敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "冰塊落地時的清脆叮鈴聲，在山腰的一片寂靜之中傳來，而在旅人的上方遠處，他們發誓說聽到了……嘻笑的聲音？",
    		artistName: "Dao Le",
    		name: "頑皮妖精",
    		cardCode: "03MT001",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT060.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT060-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 2,
    		cost: 4,
    		health: 7,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：治癒我方主堡3點生命，並對此牌造成等值傷害。",
    		descriptionRaw: "回合開始：治癒我方主堡3點生命，並對此牌造成等值傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「沒人比我更熟悉巨石峰的山徑，所以有些，呃，任性的星角獸總是纏著我。幸好牠們有我來照顧！」 ",
    		artistName: "SIXMOREVODKA",
    		name: "巨力捍衛者",
    		cardCode: "03MT060",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT033.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT033-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 8,
    		cost: 8,
    		health: 4,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：賦予2個友軍單位+0|+4。",
    		descriptionRaw: "出牌：賦予2個友軍單位+0|+4。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「奧蘇，你聽到嗎？有鈴聲！爺爺回來了！」——星辰牧羊人伊利",
    		artistName: "Polar Engine Studio",
    		name: "魯姆爾爺爺",
    		cardCode: "03MT033",
    		keywords: [
    			"勢不可擋",
    			"法盾"
    		],
    		keywordRefs: [
    			"Overwhelm",
    			"SpellShield"
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT021.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT021-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 8,
    		cost: 8,
    		health: 8,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：選擇2個敵軍單位。\r\n<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>他們。",
    		descriptionRaw: "出牌：選擇2個敵軍單位。\r\n回合開始：擊暈他們。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "傳說與這隻生物視線交錯的旅行者，會被灌輸深奧知識、淵深洞見，以致於在其凝視之下精神崩潰。",
    		artistName: "SIXMOREVODKA",
    		name: "無垠歧心龍",
    		cardCode: "03MT021",
    		keywords: [
    			"血怒"
    		],
    		keywordRefs: [
    			"Fury"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "龍族",
    		subtypes: [
    			"龍族"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT056T2",
    			"03MT056T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT056.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT056-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "<link=keyword.Nightfall><style=Keyword>夜臨</style></link>：本回合給予此牌<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。",
    		descriptionRaw: "夜臨：本回合給予此牌挑戰者。",
    		levelupDescription: "我方已發動4次或以上<link=keyword.Nightfall><style=Keyword>夜臨</style></link><style=Variable></style>。",
    		levelupDescriptionRaw: "我方已發動4次或以上夜臨。",
    		flavorText: "她傲然立於眾人之間，隨時準備戰鬥——她散發著耀眼的光芒，身穿銀色搭配藍色的盔甲，雙眸如星星般閃爍。當月亮升起，月光灑落在她身上，在場的月環教徒便閉上眼睛，為她的安全默默祈禱，也表達他們的感激之情。",
    		artistName: "SIXMOREVODKA",
    		name: "黛安娜",
    		cardCode: "03MT056",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT056T2",
    			"03MT056"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT056T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT056T1-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 3,
    		cost: 2,
    		health: 3,
    		description: "<link=keyword.Nightfall><style=Keyword>夜臨</style></link>或我方發動其他<link=keyword.Nightfall><style=Keyword>夜臨</style></link>效果時：本回合給予此牌+2|+0與<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。",
    		descriptionRaw: "夜臨或我方發動其他夜臨效果時：本回合給予此牌+2|+0與挑戰者。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "黛安娜飛奔下山，手中緊握著劍，劍刃覆滿了暮花之塵。她知道雷歐娜會找到她——她就是看準這一點。黛安娜的心因期待與焦慮而撲通亂跳，她深吸一口氣，靜下心來。這次交戰，黛安娜會占上風；這一次，她會正面迎擊老朋友。",
    		artistName: "SIXMOREVODKA",
    		name: "黛安娜",
    		cardCode: "03MT056T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT056",
    			"03MT056T1",
    			"03MT056"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT056T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT056T2-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "本回合給予1個友軍單位+2|+1。\r\n<link=keyword.Nightfall><style=Keyword>夜臨</style></link>：抽1張牌。\r\n將1張<link=card.level1><style=AssociatedCard>黛安娜</style></link>洗入我方牌組。",
    		descriptionRaw: "本回合給予1個友軍單位+2|+1。\r\n夜臨：抽1張牌。\r\n將1張黛安娜洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「在夜色掩護下，被蒼白的月亮守護著。」<br>——黛安娜",
    		artistName: "Kudos Productions",
    		name: "黛安娜 蒼白月瀑",
    		cardCode: "03MT056T2",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT067.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT067-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 4,
    		cost: 4,
    		health: 4,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：賦予1個友軍單位<br><link=keyword.Overwhelm><sprite name=Overwhelm><style=Keyword>勢不可擋</style></link>。",
    		descriptionRaw: "出牌：賦予1個友軍單位勢不可擋。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "想攀登巨石峰的人會和當地的野生動物好好相處。這裡的動物最瞭解巨石峰的危險，也能用更快的速度通過結冰的地勢。",
    		artistName: "Polar Engine Studio",
    		name: "晶角野山羊",
    		cardCode: "03MT067",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT092T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT092.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT092-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Strike><style=Vocab>打擊</style></link>：在手牌生成1張<link=card.create><style=AssociatedCard>靈力寶石</style></link>。",
    		descriptionRaw: "打擊：在手牌生成1張靈力寶石。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "巨石峰的山羊比普通山羊更加危險，因為牠們的角由寶石組成，撞擊時會在傷口裡留下碎片。 ",
    		artistName: "Polar Engine Studio",
    		name: "紫角山羊",
    		cardCode: "03MT092",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT055T2",
    			"03MT055T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT055.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT055-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 1,
    		cost: 3,
    		health: 6,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：治癒此牌及受此牌支援的友軍單位4點生命。",
    		descriptionRaw: "支援：治癒此牌及受此牌支援的友軍單位4點生命。",
    		levelupDescription: "我方治癒負傷友軍單位4次或<br>以上<style=Variable></style>。",
    		levelupDescriptionRaw: "我方治癒負傷友軍單位4次或以上。",
    		flavorText: "「治癒的本質是無私。你不需要從中汲取力量，力量是自願流出。只要展現憐憫，你就能看到治癒之光<br>閃耀。」",
    		artistName: "SIXMOREVODKA",
    		name: "索拉卡",
    		cardCode: "03MT055",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT055T2",
    			"03MT055"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT055T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT055T1-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 2,
    		cost: 3,
    		health: 7,
    		description: "每回合我方首次治癒負傷友軍單位時，抽1張牌。\r\n<link=vocab.Support><style=Vocab>支援</style></link>：完全治癒此牌及受此牌支援的友軍單位。",
    		descriptionRaw: "每回合我方首次治癒負傷友軍單位時，抽1張牌。\r\n支援：完全治癒此牌及受此牌支援的友軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「給人點滴，他人將湧泉以報，這就是付出的力量。慷慨是一種禮讚，給予者也能被治癒，心靈、身體和精神皆然。」",
    		artistName: "SIXMOREVODKA",
    		name: "索拉卡",
    		cardCode: "03MT055T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT055",
    			"03MT055T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT055T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT055T2-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "完全治癒所有負傷友軍單位。\r\n將1張<link=card.level1><style=AssociatedCard>索拉卡</style></link>洗入我方牌組。",
    		descriptionRaw: "完全治癒所有負傷友軍單位。\r\n將1張索拉卡洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「以生之名！」——索拉卡",
    		artistName: "Kudos Productions",
    		name: "索拉卡 祈願",
    		cardCode: "03MT055T2",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT092T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT048.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT048-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 1,
    		cost: 1,
    		health: 2,
    		description: "召喚此牌時，<br>在手牌生成1張<link=card.create><style=AssociatedCard>靈力寶石</style></link>。",
    		descriptionRaw: "召喚此牌時，在手牌生成1張靈力寶石。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「人們說守護者祝福了這些寶石。戴上它們，他的靈魂便會與你同在。」",
    		artistName: "SIXMOREVODKA",
    		name: "送禮人",
    		cardCode: "03MT048",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT063.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT063-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 3,
    		cost: 5,
    		health: 5,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<link=keyword.Invoke><sprite name=Invoke><style=Keyword>祈願</style></link>。",
    		descriptionRaw: "出牌：祈願。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「看看夜空中的朋友們！看到那顆特別亮的星星了嗎？那是靈犬座的眼睛，正盯著我們看呢！外邊那一簇黯淡的群星呢？那是躲在雲層後面的狡鼬座！還有那邊那……庫倫，噓！星星沒辦法抓下來啦……！」",
    		artistName: "Aron Elekes",
    		name: "白月夢舞者",
    		cardCode: "03MT063",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT006-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 5,
    		cost: 6,
    		health: 6,
    		description: "每回合具有<link=keyword.Fury><sprite name=Fury><style=Keyword>血怒</style></link>的友軍單位<br>首次擊殺敵軍單位時，在手牌隨機生成1張龍族侍從牌。",
    		descriptionRaw: "每回合具有血怒的友軍單位首次擊殺敵軍單位時，在手牌隨機生成1張龍族侍從牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「仰望天際，看見我目中的景色！首先你會看到信號，因為它們在夜晚格外耀眼；接著感受到憤怒，因為等到太陽升起，一切都將燃燒。你會見證的！每個人都將見證這一切！」——龍族先使",
    		artistName: "SIXMOREVODKA",
    		name: "音無龍獸",
    		cardCode: "03MT006",
    		keywords: [
    			"血怒"
    		],
    		keywordRefs: [
    			"Fury"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "龍族",
    		subtypes: [
    			"龍族"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT054T3",
    			"03MT054T2",
    			"03MT054T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT054.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT054-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 3,
    		cost: 4,
    		health: 5,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword></style></link><link=keyword.Daybreak><style=Keyword>破曉</style></link>：<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link><link=vocab.Strongest><style=Vocab>最強</style></link>敵軍單位。",
    		descriptionRaw: "破曉：擊暈最強敵軍單位。",
    		levelupDescription: "我方已發動4次或以上<link=keyword.Daybreak><style=Keyword>破曉</style></link><style=Variable></style>。",
    		levelupDescriptionRaw: "我方已發動4次或以上破曉。",
    		flavorText: "她傲然立於眾人之間，隨時準備戰鬥——她散發著耀眼的光芒，身穿深紅搭配金色的盔甲，雙眸如火焰般炯炯有神。當太陽升起，她頭上絢爛的光芒彷彿日光的加冕，在場的日輪教徒不禁垂下眼簾，不是因為羞愧，而是因為這是對耀眼的領袖應有的尊重。",
    		artistName: "SIXMOREVODKA",
    		name: "雷歐娜",
    		cardCode: "03MT054",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT054",
    			"03MT054T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT054T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT054T2-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "本回合給予所有友軍單位+2|+2。將1張<link=card.level1><style=AssociatedCard>雷歐娜</style></link>洗入我方牌組。\r\n<link=keyword.Daybreak><style=Keyword>破曉</style></link>：一次發動所有友軍單位的<link=keyword.Daybreak><style=Keyword>破曉</style></link><br>效果。",
    		descriptionRaw: "本回合給予所有友軍單位+2|+2。將1張雷歐娜洗入我方牌組。\r\n破曉：一次發動所有友軍單位的破曉效果。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「對我們來說，她是天空中堅定不移的領袖、正午時閃耀的刀光，也是心中永不熄滅的火焰。」\n——日輪女祭司",
    		artistName: "Kudos Productions",
    		name: "雷歐娜 旭日晨光",
    		cardCode: "03MT054T2",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT054T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT054T3-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link><link=vocab.Strongest><style=Vocab>最強</style></link>敵軍單位。",
    		descriptionRaw: "擊暈最強敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「他們越靠近天際，就越容易被太陽灼傷。」——雷歐娜\n",
    		artistName: "Kudos Productions",
    		name: "日輪聖芒",
    		cardCode: "03MT054T3",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT054T3",
    			"03MT054T2",
    			"03MT054"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT054T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT054T1-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 4,
    		cost: 4,
    		health: 6,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword></style></link><link=keyword.Daybreak><style=Keyword>破曉</style></link>或我方發動其他<link=keyword.Daybreak><style=Keyword>破曉</style></link>效果時：<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link><link=vocab.Strongest><style=Vocab>最強</style></link>敵軍單位。",
    		descriptionRaw: "破曉或我方發動其他破曉效果時：擊暈最強敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "雷歐娜早已做好萬全準備，她知道黛安娜會為了逃離陽光而飛奔下山。她深吸一口氣，用堅定的決心讓撲通亂跳的心平靜下來。這次交戰，雷歐娜占上風；這一次，她會正面迎擊老朋友。",
    		artistName: "SIXMOREVODKA",
    		name: "雷歐娜",
    		cardCode: "03MT054T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT014-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 1,
    		cost: 2,
    		health: 1,
    		description: "我方龍族魔耗值-1。",
    		descriptionRaw: "我方龍族魔耗值-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "牠們巨大的身軀周圍雲霧繚繞，牠們悲哀的叫聲，似乎連天也為之而震。她知道接下來將會發生什麼，但她感受到的不是恐懼，而是命運溫暖的懷抱。",
    		artistName: "Polar Engine Studio",
    		name: "龍族先使",
    		cardCode: "03MT014",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT058T2",
    			"03MT058T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT058.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT058-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 3,
    		cost: 4,
    		health: 4,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：本回合給予此牌及受此牌支援的友軍單位<link=keyword.Tough><sprite name=Tough><style=Keyword>堅忍</style></link>。將本回合只對此牌施放的最後一個我方法術複製，並施放在該友軍單位上（該法術無法再度被複製）。",
    		descriptionRaw: "支援：本回合給予此牌及受此牌支援的友軍單位堅忍。將本回合只對此牌施放的最後一個我方法術複製，並施放在該友軍單位上（該法術無法再度被複製）。",
    		levelupDescription: "此牌在場上時，我方以友軍單位為法術/技能目標或<link=vocab.Support><style=Vocab>支援</style></link>友軍單位7次或以上<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌在場上時，我方以友軍單位為法術/技能目標或支援友軍單位7次或以上。",
    		flavorText: "「塔里克的溫柔與善良照亮了所有遇見他的人，激勵他們找到內心深處的溫暖，就算夜晚再怎麼寒冷，他們也能繼續前進。」——群峰占術師",
    		artistName: "SIXMOREVODKA",
    		name: "塔里克",
    		cardCode: "03MT058",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT098.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT098-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "賦予1個友軍單位+0|+2。",
    		descriptionRaw: "賦予1個友軍單位+0|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們的盾代表我們的信念、決心和對光明的信心！」——日輪持盾兵",
    		artistName: "Kudos Productions",
    		name: "日鋼護體",
    		cardCode: "03MT098",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT085.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT085-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "本回合<link=vocab.Silence><style=Vocab>沉默</style></link>1個單位。",
    		descriptionRaw: "本回合沉默1個單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「他們會明白何謂寧靜。」——索拉卡",
    		artistName: "Kudos Productions",
    		name: "靜寂噓鳴",
    		cardCode: "03MT085",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT001T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT001T1-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>力量值2點或以下的所有敵軍單位。",
    		descriptionRaw: "擊暈力量值2點或以下的所有敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「哈哈哈哈，看看他們跑來跑去的樣子！真是好快啊！你也頭暈了嗎？」——柔依",
    		artistName: "Kudos Productions",
    		name: "惡作劇",
    		cardCode: "03MT001T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT075.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT075-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 2,
    		cost: 3,
    		health: 1,
    		description: "<link=keyword.Nightfall><style=Keyword>夜臨</style></link>：<link=keyword.Invoke><sprite name=Invoke><style=Keyword>祈願</style></link>。",
    		descriptionRaw: "夜臨：祈願。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「在廣闊的夜空中前行，有如朝聖者般的星星啊，請稍稍停下腳步，與我們分享你們的所見所聞。」——《夜之頌歌》",
    		artistName: "Kudos Productions",
    		name: "月環女祭司",
    		cardCode: "03MT075",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT020-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 4,
    		cost: 5,
    		health: 5,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：治癒1個友軍單位以及我方主堡3點生命。",
    		descriptionRaw: "出牌：治癒1個友軍單位以及我方主堡3點生命。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「看到那個橫跨夜空的星星嗎？那是一隻成體的星角獸。年幼的星角獸會把牠們的治癒法力借給我們使用，而成體的星角獸則能自己駕馭那股力量。能看到並認出成體的星角獸，是一件非常幸運的事。不過，能夠照顧牠更為幸運。」——守星者里達利",
    		artistName: "SIXMOREVODKA",
    		name: "光輝星角獸",
    		cardCode: "03MT020",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT071.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT071-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：賦予受此牌支援的友軍單位+0|+2。",
    		descriptionRaw: "支援：賦予受此牌支援的友軍單位+0|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "旅行時，你必須對這趟旅程敞開心胸，因為它必將改變你。旅行時，你會帶走一些新事物……並留下一部分過去的自己。 ",
    		artistName: "SIXMOREVODKA",
    		name: "漂泊旅者泰亞歷",
    		cardCode: "03MT071",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT002-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 15,
    		health: 0,
    		description: "對所有敵軍單位造成15點傷害。\r\n每有1個龍族或天界友軍單位，則此牌魔耗值-2。",
    		descriptionRaw: "對所有敵軍單位造成15點傷害。\r\n每有1個龍族或天界友軍單位，則此牌魔耗值-2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「等時機成熟，也許我會拿符文大地來殺雞儆猴。或許我可以拖著這個被焚為灰燼、了無生機的空殼，作為他人永世的警惕。就像一個毫無用處的玩具一樣。再看看吧，目前還沒考慮太多。」——翱銳龍獸",
    		artistName: "Kudos Productions",
    		name: "天界殞落",
    		cardCode: "03MT002",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT086.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT086-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：棄置1張牌，即可<link=keyword.Invoke><sprite name=Invoke><style=Keyword>祈願</style></link>1張魔耗值3點或以下的天界牌。",
    		descriptionRaw: "出牌：棄置1張牌，即可祈願1張魔耗值3點或以下的天界牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「這是我的最愛！我叫它『形而上的意識心理』，除非你這樣歪著頭看……這樣看起來就像兩支湯匙了。」",
    		artistName: "Dao Le",
    		name: "異想畫師",
    		cardCode: "03MT086",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT087T2",
    			"03MT087T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT087.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT087-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 10,
    		cost: 10,
    		health: 10,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<link=keyword.Invoke><sprite name=Invoke><style=Keyword>祈願</style></link>1張魔耗值7點或以上的天界牌。\r\n<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：在手牌隨機生成1張<br>天界牌。",
    		descriptionRaw: "出牌：祈願1張魔耗值7點或以上的天界牌。\r\n回合開始：在手牌隨機生成1張天界牌。",
    		levelupDescription: "<link=vocab.RoundEnd><style=Vocab>回合結束</style></link>：我方場上友軍單位力量值總和達25點或以上<style=Variable></style>。",
    		levelupDescriptionRaw: "回合結束：我方場上友軍單位力量值總和達25點或以上。",
    		flavorText: "「我才不在乎你們人類怎麼寫我的介紹呢！<br>只要提到我英俊非凡，而且超～級聰明就好。<br>這麼簡單應該不會寫錯字吧？」",
    		artistName: "SIXMOREVODKA",
    		name: "翱銳龍獸",
    		cardCode: "03MT087",
    		keywords: [
    			"血怒",
    			"法盾"
    		],
    		keywordRefs: [
    			"Fury",
    			"SpellShield"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "龍族",
    		subtypes: [
    			"龍族"
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT087T2",
    			"03MT087"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT087T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT087T1-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 11,
    		cost: 10,
    		health: 11,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<link=keyword.Invoke><sprite name=Invoke><style=Keyword>祈願</style></link>1張魔耗值7點或以上的天界牌。\r\n<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：在手牌隨機生成1張<br>天界牌。\r\n我方的天界牌魔耗值為0。",
    		descriptionRaw: "出牌：祈願1張魔耗值7點或以上的天界牌。\r\n回合開始：在手牌隨機生成1張天界牌。\r\n我方的天界牌魔耗值為0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "翱銳龍獸英俊不凡，而且超～級蔥明。",
    		artistName: "SIXMOREVODKA",
    		name: "翱銳龍獸",
    		cardCode: "03MT087T1",
    		keywords: [
    			"血怒",
    			"法盾"
    		],
    		keywordRefs: [
    			"Fury",
    			"SpellShield"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "龍族",
    		subtypes: [
    			"龍族"
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT087",
    			"03MT087T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT087T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT087T2-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 15,
    		health: 0,
    		description: "對所有敵軍單位造成15點傷害。\r\n每有1個龍族或天界友軍單位，<br>則此牌魔耗值-2。\r\n將1張<link=card.level1><style=AssociatedCard>翱銳龍獸</style></link>洗入我方牌組。",
    		descriptionRaw: "對所有敵軍單位造成15點傷害。\r\n每有1個龍族或天界友軍單位，則此牌魔耗值-2。\r\n將1張翱銳龍獸洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「等時機成熟，也許我會拿符文大地來殺雞儆猴。或許我可以拖著這個被焚為灰燼、了無生機的空殼，作為他人永世的警惕。就像一個毫無用處的玩具一樣。再看看吧，目前還沒考慮太多。」——翱銳龍獸",
    		artistName: "Kudos Productions",
    		name: "翱銳龍獸 天界殞落",
    		cardCode: "03MT087T2",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT019-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "賦予1個友軍單位+1|+1與<br><link=keyword.SpellShield><sprite name=SpellShield><style=Keyword>法盾</style></link>。",
    		descriptionRaw: "賦予1個友軍單位+1|+1與法盾。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「應當敬畏群峰。」——塔里克",
    		artistName: "Kudos Productions",
    		name: "星護壁壘",
    		cardCode: "03MT019",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT008-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "完全治癒所有負傷友軍單位。",
    		descriptionRaw: "完全治癒所有負傷友軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「以生之名！」——索拉卡",
    		artistName: "Kudos Productions",
    		name: "祈願",
    		cardCode: "03MT008",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT023.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT023-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "對1個單位造成6點傷害。\r\n<link=keyword.Daybreak><style=Keyword>破曉</style></link>：造成傷害前，本回合先<link=vocab.Silence><style=Vocab>沉默</style></link>該單位。",
    		descriptionRaw: "對1個單位造成6點傷害。\r\n破曉：造成傷害前，本回合先沉默該單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "能夠承受烈日凝視的生物屈指可數。",
    		artistName: "Kudos Productions",
    		name: "萬丈朝陽",
    		cardCode: "03MT023",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT096.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT096-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 1,
    		cost: 3,
    		health: 2,
    		description: "<link=keyword.Daybreak><style=Keyword>破曉</style></link>：<link=keyword.Invoke><sprite name=Invoke><style=Keyword>祈願</style></link>1張魔耗值4點、5點或6點的天界牌。\r\n",
    		descriptionRaw: "破曉：祈願1張魔耗值4點、5點或6點的天界牌。\r\n",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "和其他巨石峰人一樣，日輪教徒也會尋求星星的指引，因為他們深深信仰的太陽也是一顆星星。",
    		artistName: "Grafit Studio",
    		name: "日輪女祭司",
    		cardCode: "03MT096",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT045.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT045-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "治癒1個友軍單位4點生命，並賦予其+0|+4。",
    		descriptionRaw: "治癒1個友軍單位4點生命，並賦予其+0|+4。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你以為打敗我們了嗎？哈！還早得很呢。」<br>——巨力捍衛者",
    		artistName: "Max Grecke",
    		name: "星之護佑",
    		cardCode: "03MT045",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT080T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT080.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT080-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "召喚此牌時，在手牌生成1張<br><link=card.spell><style=AssociatedCard>泉之禮讚</style></link>。",
    		descriptionRaw: "召喚此牌時，在手牌生成1張泉之禮讚。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我很在意泉水，不過還是得以牧羊人的職責優先，羊群第一。真是讓人困擾。」",
    		artistName: "Polar Engine",
    		name: "護泉者",
    		cardCode: "03MT080",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT080T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT080T1-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "完全治癒1個友軍單位。",
    		descriptionRaw: "完全治癒1個友軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「讓泉水治癒你的苦痛。」——護泉者",
    		artistName: "Max Grecke",
    		name: "泉之禮讚",
    		cardCode: "03MT080T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT044.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT044-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 4,
    		cost: 6,
    		health: 3,
    		description: "<link=keyword.Daybreak><style=Keyword>破曉</style></link>：本回合給予此牌+4|+4。",
    		descriptionRaw: "破曉：本回合給予此牌+4|+4。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「光明的守護者啊，你的憤怒如同正午的烈日一般燃燒，請務必懲罰闖入聖地的無禮之徒。」——耀日守護者銘文",
    		artistName: "SIXMOREVODKA",
    		name: "耀日守護者",
    		cardCode: "03MT044",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT092T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT041.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT041-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 1,
    		cost: 3,
    		health: 1,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：賦予受此牌支援的友軍單位+2|+2。\r\n<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：在手牌生成3張<link=card.create><style=AssociatedCard>靈力寶石</style></link>。",
    		descriptionRaw: "支援：賦予受此牌支援的友軍單位+2|+2。\r\n遺願：在手牌生成3張靈力寶石。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「剛才他說的，你聽得懂嗎？」\n「一個字都不懂，但應該是好話。」\n——居山者埃爾米和海利",
    		artistName: "SIXMOREVODKA",
    		name: "群岩導師",
    		cardCode: "03MT041",
    		keywords: [
    			"遺願"
    		],
    		keywordRefs: [
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT028.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT028-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "<link=keyword.Daybreak><style=Keyword>破曉</style></link>：本回合給予此牌+0|+4。",
    		descriptionRaw: "破曉：本回合給予此牌+0|+4。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「真愚蠢，竟然不選擇在夜晚偷襲。」日輪持盾兵挺直身體。「放下武器投降吧。」\n月環教徒一言不發，蹲下來，緊握彎刀擺好架勢。\n同樣地，日輪持盾兵舉起盾牌，反射日出太陽的光芒。一場激戰在所難免。 ",
    		artistName: "Kudos Productions",
    		name: "日輪持盾兵",
    		cardCode: "03MT028",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT072.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT072-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 5,
    		cost: 5,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "無數挑戰等待著想登上巨石峰頂的人，有些像無止盡的攀升一樣，會慢慢削弱胸懷大志者的精力，有些則是更加急迫的威脅。",
    		artistName: "Jihun Lee",
    		name: "混源龍怪",
    		cardCode: "03MT072",
    		keywords: [
    			"血怒",
    			"法盾"
    		],
    		keywordRefs: [
    			"Fury",
    			"SpellShield"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "龍族",
    		subtypes: [
    			"龍族"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT092T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT025.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT025-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "以<link=card.create><style=AssociatedCard>靈力寶石</style></link>補滿我方手牌。",
    		descriptionRaw: "以靈力寶石補滿我方手牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「把寶石轉動到適當的角度，便能反射出奪目光輝；每個人的生命也一樣，內心都有一把燃燒著的火。」——塔里克",
    		artistName: "Kudos Productions",
    		name: "石峰破片",
    		cardCode: "03MT025",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT018"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT017-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "將5張<link=card.shuffle><style=AssociatedCard>靈犬座</style></link>洗入我方牌組。",
    		descriptionRaw: "將5張靈犬座洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「時光流逝，星移斗轉，靈犬座取代了巨蛇座的位置，豐收的季節即將到來……」——月環教女祭司",
    		artistName: "Max Grecke",
    		name: "靈犬座刻碑",
    		cardCode: "03MT017",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT051.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT051-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "治癒1個友軍單位或我方主堡2點生命。抽1張牌。",
    		descriptionRaw: "治癒1個友軍單位或我方主堡2點生命。抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "星角獸開心時會散發最亮的光芒。",
    		artistName: "Kudos Productions",
    		name: "引導之觸",
    		cardCode: "03MT051",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT012-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 6,
    		cost: 10,
    		health: 6,
    		description: "本牌局我方每次指定友軍單位為法術或技能目標，或支援友軍單位，則此牌魔耗值-1。",
    		descriptionRaw: "本牌局我方每次指定友軍單位為法術或技能目標，或支援友軍單位，則此牌魔耗值-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "仲裁者是登山的最終考驗，因為只有這個守護者的視線能穿透登山者外在的成就，直視他們內在的靈魂。",
    		artistName: "SIXMOREVODKA",
    		name: "凜峰仲裁者",
    		cardCode: "03MT012",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT094.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT094-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "<link=keyword.Nightfall><style=Keyword>夜臨</style></link>：賦予此牌<link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>。",
    		descriptionRaw: "夜臨：賦予此牌隱密。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「讓我們仰望天際，仰望太陽，仰望女神之……等等……什麼……？那是什麼……？」——日輪祭司",
    		artistName: "Kudos Productions",
    		name: "月環潛影者",
    		cardCode: "03MT094",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT076.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT076-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 2,
    		cost: 4,
    		health: 3,
    		description: "我方的天界牌魔耗值-1。\r\n<link=vocab.Allegiance><style=Vocab>效忠</style></link>：<link=keyword.Invoke><sprite name=Invoke><style=Keyword>祈願</style></link>。",
    		descriptionRaw: "我方的天界牌魔耗值-1。\r\n效忠：祈願。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「在星星的指引下，我們可以學到很多。對我們來說，恆常不變的星星能幫助我們找到方向。」",
    		artistName: "SIXMOREVODKA",
    		name: "群峰占術師",
    		cardCode: "03MT076",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT100.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT100-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 7,
    		cost: 7,
    		health: 7,
    		description: "<link=keyword.Daybreak><style=Keyword>破曉</style></link>：我方打出的下一個龍族或天界單位魔耗值-2。\r\n<link=keyword.Nightfall><style=Keyword>夜臨</style></link>：在手牌隨機生成1張龍族侍從牌和天界侍從牌。",
    		descriptionRaw: "破曉：我方打出的下一個龍族或天界單位魔耗值-2。\r\n夜臨：在手牌隨機生成1張龍族侍從牌和天界侍從牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "龍鱗（屬於陰蝕巨龍，其學名為Draco Obscuratus）\n筆記：龍鱗有極佳的反光性，<br>陽光直射時會強烈反光。\n潦草筆記：它晚上還會發光！\n——蛋頭學者安登·梅恩的筆記",
    		artistName: "SIXMOREVODKA",
    		name: "陰蝕巨龍",
    		cardCode: "03MT100",
    		keywords: [
    			"血怒"
    		],
    		keywordRefs: [
    			"Fury"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    			"龍族"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT058T2",
    			"03MT058"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT058T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT058T1-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 4,
    		cost: 4,
    		health: 5,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：本回合此牌及受此牌支援的友軍單位免疫傷害及死亡。將本回合只對此牌施放的最後一個我方法術複製，並施放在該友軍單位上（該法術無法再度被複製）。",
    		descriptionRaw: "支援：本回合此牌及受此牌支援的友軍單位免疫傷害及死亡。將本回合只對此牌施放的最後一個我方法術複製，並施放在該友軍單位上（該法術無法再度被複製）。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「塔里克為何要對人類同胞釋出善意？這個心靈受創的男人來到了巨石峰，打算爬到山頂贖罪……而他最後成功了。因此沒有人比他更了解，所有支離破碎的事物都能再次變得美麗。」——群峰占術師",
    		artistName: "SIXMOREVODKA",
    		name: "塔里克",
    		cardCode: "03MT058T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03MT058",
    			"03MT058T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT058T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT058T2-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "賦予1個友軍單位+3|+3。\r\n將1張<link=card.level1><style=AssociatedCard>塔里克</style></link>洗入我方牌組。",
    		descriptionRaw: "賦予1個友軍單位+3|+3。\r\n將1張塔里克洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「來自巨石峰的一點小心意。」——塔里克",
    		artistName: "Max Grecke",
    		name: "塔里克 巨石峰的祝福",
    		cardCode: "03MT058T2",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT029.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT029-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 1,
    		health: 3,
    		description: "每當我方治癒負傷的友軍單位，便賦予此牌+2|+0。",
    		descriptionRaw: "每當我方治癒負傷的友軍單位，便賦予此牌+2|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「自從我看到一隻星角獸劃破夜空之後，我就喜歡牠們。誰知道，現在我竟然會遇上這麼多！」",
    		artistName: "SIXMOREVODKA",
    		name: "星辰牧羊人",
    		cardCode: "03MT029",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT092T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT092T1-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "治癒1個友軍單位1點生命，並賦予其+1|+0。\r\n無法在戰鬥中施放，<br>或用來對應其他法術。",
    		descriptionRaw: "治癒1個友軍單位1點生命，並賦予其+1|+0。\r\n無法在戰鬥中施放，或用來對應其他法術。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「不需要眼見為憑……只要有信心即可。」——漂泊旅者泰亞歷",
    		artistName: "Kudos Productions",
    		name: "靈力寶石",
    		cardCode: "03MT092T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT062.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT062-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 2,
    		cost: 3,
    		health: 2,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：若我方<link=vocab.Behold><style=Vocab>掌控</style></link>天界牌，則賦予1個友軍單位+1|+1與<link=keyword.SpellShield><sprite name=SpellShield><style=Keyword>法盾</style></link>。",
    		descriptionRaw: "出牌：若我方掌控天界牌，則賦予1個友軍單位+1|+1與法盾。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「……然後呢，火花蟲就像掉到地上的星塵一樣，然後呢，又飛起來，超棒的，然後呢，我昨晚看到一隻，超漂亮的，然後呢，我肚子餓了，然後呢，它飛上天空，變成了星星，然後呢……」",
    		artistName: "Dao Le",
    		name: "亮晶晶研究家",
    		cardCode: "03MT062",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT082.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT082-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "本回合給予所有友軍單位+2|+2。\r\n<link=keyword.Daybreak><style=Keyword>破曉</style></link>：一次發動所有友軍單位的<link=keyword.Daybreak><style=Keyword>破曉</style></link><br>效果。",
    		descriptionRaw: "本回合給予所有友軍單位+2|+2。\r\n破曉：一次發動所有友軍單位的破曉效果。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們隨著黎明而起！邁向光明！」——雷歐娜",
    		artistName: "Kudos Productions",
    		name: "旭日晨光",
    		cardCode: "03MT082",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT047.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT047-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 5,
    		cost: 6,
    		health: 3,
    		description: "<link=keyword.Nightfall><style=Keyword>夜臨</style></link>：本回合給予此牌與1個友軍單位<link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>。",
    		descriptionRaw: "夜臨：本回合給予此牌與1個友軍單位隱密。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "席格納斯靜等日落，等待黑夜的掩護。雖然前面的路看起來寂寥無人，但這名月環教徒很清楚日輪教營地就在前頭。他擺出手勢，跟隨者便無聲無息地在他身後列隊。",
    		artistName: "JiHun Lee",
    		name: "月隱者席格納斯",
    		cardCode: "03MT047",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT038.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT038-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 4,
    		cost: 4,
    		health: 4,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「首先結識這些較年輕且愛好和平的龍族，是居住在巨石峰的孩童。也許是由於這些幼龍能夠感應到孩童的純真好奇之心，所以牠們選擇不傷害他們，反過來保護他們。」 ",
    		artistName: "Aron Elekes",
    		name: "白燄衛龍",
    		cardCode: "03MT038",
    		keywords: [
    			"血怒"
    		],
    		keywordRefs: [
    			"Fury"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "龍族",
    		subtypes: [
    			"龍族"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT081.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT081-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 2,
    		cost: 5,
    		health: 5,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：賦予受此牌支援的友軍單位+2|+2。若該單位有<link=vocab.Support><style=Vocab>支援</style></link>特性，則同樣賦予受其支援的友軍單位+2|+2，以此類推。",
    		descriptionRaw: "支援：賦予受此牌支援的友軍單位+2|+2。若該單位有支援特性，則同樣賦予受其支援的友軍單位+2|+2，以此類推。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "所有敢於挑戰巨石峰的人都有自己的原因。有些人是為了向同儕證明自己，有些人則全然是為了自己。",
    		artistName: "SIXMOREVODKA",
    		name: "群峰旅者",
    		cardCode: "03MT081",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT007-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 1,
    		cost: 3,
    		health: 2,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「就如任何幼獸一樣，年幼的星角獸終有一日必須首次飛翔。在這個意義上，牠們跟夜空流星一樣，一瞬間就會墜落。幸好有我們在這裡接住牠們，然後等牠們準備好了，讓牠們回歸天空。」——守星者里達利",
    		artistName: "SIXMOREVODKA",
    		name: "星角幼獸",
    		cardCode: "03MT007",
    		keywords: [
    			"吸血",
    			"法盾"
    		],
    		keywordRefs: [
    			"Lifesteal",
    			"SpellShield"
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT026.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT026-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 5,
    		cost: 5,
    		health: 5,
    		description: "<link=keyword.Daybreak><style=Keyword>破曉</style></link>：在手牌隨機生成1張\r\n英雄牌以外的<link=keyword.Daybreak><style=Keyword>破曉</style></link>牌。\r\n此牌在場上時，我方卡牌不論日夜\r\n皆可觸發破曉。",
    		descriptionRaw: "破曉：在手牌隨機生成1張\r\n英雄牌以外的破曉牌。\r\n此牌在場上時，我方卡牌不論日夜\r\n皆可觸發破曉。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「拉克爾，保持信念，我們的光輝就會永不熄滅！」",
    		artistName: "JiHun Lee",
    		name: "日光之矛拉馮",
    		cardCode: "03MT026",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT110.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT110-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "使友軍單位獲得的增益一直持續到牌局結束（光盾除外）。<br>抽1張牌。",
    		descriptionRaw: "使友軍單位獲得的增益一直持續到牌局結束（光盾除外）。抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "\"You know I mean everything that I say\nWhen you see me coming get out of the way\nI came to slay I came to slay\nBack and I'm better and ready to stay.\"\n「我這人說話句句認真\n識相就快快滾出大門\n現在我來大開殺戒\n塵埃落定我就征服世界」\n——凱莎〈THE BADDEST〉",
    		artistName: "Kudos Productions",
    		name: "別擋路",
    		cardCode: "03MT110",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT003-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "抽出2張不同的龍族牌或賦予龍族友軍單位+1|+1。",
    		descriptionRaw: "抽出2張不同的龍族牌或賦予龍族友軍單位+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「牠們的叫聲聽起來就像刺耳的貓叫，聽到時一定要拔腿就跑，並通知最近的守衛，知道了嗎？因為龍蛋附近一定有龍族徘徊。」——巨石峰覓食者",
    		artistName: "Kudos Productions",
    		name: "巨龍蛋",
    		cardCode: "03MT003",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT030.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT030-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 3,
    		cost: 4,
    		health: 4,
    		description: "治癒負傷的友軍單位時，本回合給予其<link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>。",
    		descriptionRaw: "治癒負傷的友軍單位時，本回合給予其隱密。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「星星只會待在我們身邊一段時間，等到受到充分的照顧，我就會讓星子帶著閃耀的光芒……還有揮動的蹄子回歸天際。」",
    		artistName: "SIXMOREVODKA",
    		name: "占星家",
    		cardCode: "03MT030",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT088.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT088-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 2,
    		cost: 1,
    		health: 2,
    		description: "<link=keyword.Daybreak><style=Keyword>破曉</style></link>：本回合給予此牌+1|+1。",
    		descriptionRaw: "破曉：本回合給予此牌+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "當升起的太陽溫暖了他的身子，他看守著異教徒的牢房，對囚犯的輕聲哀求充耳不聞，<br>對方也很快就沉默了。",
    		artistName: "Wild Blue Studio",
    		name: "日輪士兵",
    		cardCode: "03MT088",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT089.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT089-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "<link=keyword.Nightfall><style=Keyword>夜臨</style></link>：賦予此牌+2|+0。",
    		descriptionRaw: "夜臨：賦予此牌+2|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「堅毅的守護者啊，溫柔的滿月之光將恢復你的力量。甦醒吧，請保護我們，阻止闖入聖地的無禮之徒。」——新月守護者銘文",
    		artistName: "Aron Elekes",
    		name: "新月守護者",
    		cardCode: "03MT089",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT027.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT027-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "賦予1個友軍單位+1|+2<br>與<link=keyword.Overwhelm><sprite name=Overwhelm><style=Keyword>勢不可擋</style></link>。\r\n<link=keyword.Daybreak><style=Keyword>破曉</style></link>：抽1張<link=card.me><style=AssociatedCard>太陽聖劍</style></link>。",
    		descriptionRaw: "賦予1個友軍單位+1|+2與勢不可擋。\r\n破曉：抽1張太陽聖劍。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「讓耀日的力量在你身上充盈灌注！」——日輪祭司",
    		artistName: "Kudos Productions",
    		name: "太陽聖劍",
    		cardCode: "03MT027",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT084.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT084-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "<link=keyword.Invoke><sprite name=Invoke><style=Keyword>祈願</style></link>1張魔耗值7點或以上的天界牌，並治癒1個友軍單位或我方主堡5點生命。",
    		descriptionRaw: "祈願1張魔耗值7點或以上的天界牌，並治癒1個友軍單位或我方主堡5點生命。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「仰望星空吧。幸運的話，還會跟我四目相對呢。」——翱銳龍獸",
    		artistName: "Kudos Productions",
    		name: "星之誕",
    		cardCode: "03MT084",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT016-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「哎喲，大大的星界象不想穿過小小的傳送門？沒關係，那我們……哈哈哈，騙你的，給我去吧！」<br>——柔依",
    		artistName: "SIXMOREVODKA",
    		name: "害怕的星界象",
    		cardCode: "03MT016",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT035.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT035-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "本回合給予1個友軍單位+2|+1。\r\n<link=keyword.Nightfall><style=Keyword>夜臨</style></link>：抽1張牌。",
    		descriptionRaw: "本回合給予1個友軍單位+2|+1。\r\n夜臨：抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「在夜色掩護下，被蒼白的月亮守護著。」<br>——黛安娜",
    		artistName: "Kudos Productions",
    		name: "蒼白月瀑",
    		cardCode: "03MT035",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT003T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT003T1-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "抽出2張不同的龍族牌。",
    		descriptionRaw: "抽出2張不同的龍族牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "龍蛋（屬於銳嘯飛龍，其學名為Draco Murmurationis）\n筆記：上次轉動時，蛋殼變脆弱了，內部活動增加，表面出現裂痕，是否有破殼跡象？\n潦草筆記：蛋要孵化了！\n——蛋頭學者安登·梅恩的筆記",
    		artistName: "Kudos Productions",
    		name: "破殼龍蛋",
    		cardCode: "03MT003T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT003T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT003T2-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "賦予龍族友軍單位+1|+1。",
    		descriptionRaw: "賦予龍族友軍單位+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "龍蛋（屬於銳嘯飛龍，其學名為Draco Murmurationis）\n筆記：上次轉動時，蛋殼變脆弱了，內部活動增加，表面出現裂痕，是否有破殼跡象？\n潦草筆記：蛋要孵化了！\n——蛋頭學者安登·梅恩的筆記",
    		artistName: "Kudos Productions",
    		name: "裂殼龍蛋",
    		cardCode: "03MT003T2",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT036.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT036-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "賦予1個友軍單位+3|+3。",
    		descriptionRaw: "賦予1個友軍單位+3|+3。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「來自巨石峰的一點小心意。」——塔里克",
    		artistName: "Max Grecke",
    		name: "巨石峰的祝福",
    		cardCode: "03MT036",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT039.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT039-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "在太空中，再怎麼大聲尖叫都不會有人聽見。",
    		artistName: "Dao Le",
    		name: "普蝶",
    		cardCode: "03MT039",
    		keywords: [
    			"法盾"
    		],
    		keywordRefs: [
    			"SpellShield"
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE008-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，若我方<link=vocab.Behold><style=Vocab>掌控</style></link>龍族牌，則賦予此牌<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。",
    		descriptionRaw: "召喚此牌時，若我方掌控龍族牌，則賦予此牌挑戰者。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我以為我的決心已在威沃之戰中隨著同袍一同逝去了……但後來發現，只要再次經歷戰鬥便可以重新喚醒老兵的意志。」",
    		artistName: "SIXMOREVODKA",
    		name: "龍衛中尉",
    		cardCode: "03DE008",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE001-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "賦予1個友軍單位<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。",
    		descriptionRaw: "賦予1個友軍單位挑戰者。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「沒人能逃出我們手掌心！」——希瓦娜",
    		artistName: "Kudos Productions",
    		name: "迎敵之息",
    		cardCode: "03DE001",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE015.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE015-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 1,
    		cost: 2,
    		health: 3,
    		description: "所有法術的魔耗值+1。",
    		descriptionRaw: "所有法術的魔耗值+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "一開始說不上是什麼樣子，只是粗略鑿下的一塊反魔法英石，在雕刻家的巧手之下迅速成形，作品開始變得栩栩如生。",
    		artistName: "SIXMOREVODKA",
    		name: "抗魔英石雕",
    		cardCode: "03DE015",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE006-full.png"
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
    		flavorText: "保護幼子是所有生物的天性，不過論應付威脅的能力，能比得上龍族的不多。",
    		artistName: "SIXMOREVODKA",
    		name: "銳嘯飛龍",
    		cardCode: "03DE006",
    		keywords: [
    			"挑戰者",
    			"血怒"
    		],
    		keywordRefs: [
    			"Challenger",
    			"Fury"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "龍族",
    		subtypes: [
    			"龍族"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE002-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "使1個友軍單位與1個敵軍單位互相<link=vocab.Strike><style=Vocab>打擊</style></link>。若友軍單位為龍族，打擊後可恢復2點生命。",
    		descriptionRaw: "使1個友軍單位與1個敵軍單位互相打擊。若友軍單位為龍族，打擊後可恢復2點生命。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "當騎士和龍族從廝殺中分開後，殘喘受傷的龍似乎又重獲力量。牠聞到了鮮血的味道，並渴望更多。",
    		artistName: "Kudos Productions",
    		name: "掠翼轟擊",
    		cardCode: "03DE002",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03DE002",
    			"03DE011T2",
    			"03DE011T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE011-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 4,
    		health: 4,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：本回合給予此牌+1|+1。",
    		descriptionRaw: "攻擊：本回合給予此牌+1|+1。",
    		levelupDescription: "此牌在場上時，龍族友軍單位造成12點或以上傷害<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌在場上時，龍族友軍單位造成12點或以上傷害。",
    		flavorText: "「一方面，她的本質與我們最痛恨的敵人相同，她的族類過去為蒂瑪西亞帶來的只有災禍。但另一方面，她又深受王子信賴，也看似足以成為意志堅定的戰士，和我們可貴的友軍。我只希望她不會背叛我們對她的信任。」\n——傑里克中尉的威沃見聞",
    		artistName: "SIXMOREVODKA",
    		name: "希瓦娜",
    		cardCode: "03DE011",
    		keywords: [
    		],
    		keywordRefs: [
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "英雄",
    		rarityRef: "Champion",
    		subtype: "龍族",
    		subtypes: [
    			"龍族"
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03DE002",
    			"03DE011T2",
    			"03DE011"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE011T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE011T1-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 5,
    		cost: 4,
    		health: 5,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：本回合給予此牌+2|+2，並在手牌生成1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.create><style=AssociatedCard>掠翼轟擊</style></link>。",
    		descriptionRaw: "攻擊：本回合給予此牌+2|+2，並在手牌生成1張飛逝掠翼轟擊。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「第一次見到她變身時，我內心感到十分厭惡。那個身纏憤怒之火的便是伊凡娜！她後來竟成為了我們的戰友，也是名士兵的典範……更是我最親近的朋友，要是當時早知道就好了。」\n——傑里克中尉的威沃見聞",
    		artistName: "SIXMOREVODKA",
    		name: "希瓦娜 聖龍型態",
    		cardCode: "03DE011T1",
    		keywords: [
    			"血怒"
    		],
    		keywordRefs: [
    			"Fury"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "龍族",
    		subtypes: [
    			"龍族"
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03DE011",
    			"03DE011T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE011T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE011T2-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "賦予1個友軍單位<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。\r\n將1張<link=card.level1><style=AssociatedCard>希瓦娜</style></link>洗入我方牌組。",
    		descriptionRaw: "賦予1個友軍單位挑戰者。\r\n將1張希瓦娜洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「沒人能逃出我們手掌心！」——希瓦娜",
    		artistName: "Kudos Productions",
    		name: "希瓦娜 迎敵之息",
    		cardCode: "03DE011T2",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE003-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 6,
    		health: 5,
    		description: "召喚此牌時，若我方<link=vocab.Behold><style=Vocab>掌控</style></link>龍族牌，則進行<link=vocab.Rally><style=Vocab>備戰</style></link>。",
    		descriptionRaw: "召喚此牌時，若我方掌控龍族牌，則進行備戰。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「遠方有東西！會不會是……？」\n「似乎是。」\n「你怎麼知道？」\n「相信我，我絕不會看錯。快摀住耳朵，這東西超大聲的。」<br>——安登和耶夏妮亞",
    		artistName: "SIXMOREVODKA",
    		name: "龍衛瞭望兵",
    		cardCode: "03DE003",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE013.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE013-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 6,
    		cost: 7,
    		health: 6,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「小心點士兵！如果我們能注意步伐，不驚動巢穴，就能避免讓母龍作出激進的行為。但如果再激怒牠……那麼，你只能祈禱你跑得夠快。」<br>——蛋頭學者安登·梅恩",
    		artistName: "SIXMOREVODKA",
    		name: "潛行龍母",
    		cardCode: "03DE013",
    		keywords: [
    			"血怒",
    			"先遣"
    		],
    		keywordRefs: [
    			"Fury",
    			"Scout"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "普通",
    		rarityRef: "Common",
    		subtype: "",
    		subtypes: [
    			"龍族"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE005-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 1,
    		cost: 2,
    		health: 3,
    		description: "召喚此牌時，在手牌隨機生成1張龍族侍從牌。",
    		descriptionRaw: "召喚此牌時，在手牌隨機生成1張龍族侍從牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "龍蛋（屬於銳嘯飛龍，其學名為Draco Murmurationis）\n地點：學者安登·梅恩遠征時發現。\n筆記：孵化期不明，繼續保溫。最近觀察到殼內有活動。蛋對熱、光和敲擊有反應。<br>研究目前仍沒有結論。\n——蛋頭學者安登·梅恩的筆記",
    		artistName: "SIXMOREVODKA",
    		name: "蛋頭學者",
    		cardCode: "03DE005",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE007-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 9,
    		cost: 9,
    		health: 6,
    		description: "召喚此牌時，賦予<link=vocab.Everywhere><style=Vocab>各處</style></link>其他龍族友軍單位+2|+2。",
    		descriptionRaw: "召喚此牌時，賦予各處其他龍族友軍單位+2|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "當蒂瑪西亞突然遭受巨龍猛攻時，希瓦娜便知道這都是煉燄飛龍卡卓格林幹的好事。其他巨龍被他放肆的天性和猛烈的火焰所煽動，使蒂瑪西亞陷入<br>恐懼之中。 ",
    		artistName: "SIXMOREVODKA",
    		name: "煉燄飛龍卡卓格林",
    		cardCode: "03DE007",
    		keywords: [
    			"血怒"
    		],
    		keywordRefs: [
    			"Fury"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "龍族",
    		subtypes: [
    			"龍族"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE016"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE012-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "每召喚1個菁英單位時，<br>使此牌魔耗值-1。\r\n本回合每有1個友軍單位陣亡，<br>則召喚1個<link=card.summon><style=AssociatedCard>無畏先鋒</style></link>。",
    		descriptionRaw: "每召喚1個菁英單位時，使此牌魔耗值-1。\r\n本回合每有1個友軍單位陣亡，則召喚1個無畏先鋒。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「一個士兵倒下，另一個就得頂上。不能讓我們的旌旗倒下。」——蓋倫",
    		artistName: "Kudos Productions",
    		name: "哀兵必勝",
    		cardCode: "03DE012",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03DE014-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "本回合給予1個友軍單位+2|+2，並使此單位能夠格擋<link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>單位。",
    		descriptionRaw: "本回合給予1個友軍單位+2|+2，並使此單位能夠格擋隱密單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "膽敢突破蒂瑪西亞城牆的人會發現，後頭有一整支重裝軍隊，正在虎視眈眈地等著他。",
    		artistName: "Kudos Productions",
    		name: "銳目",
    		cardCode: "03DE014",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO017-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 1,
    		health: 2,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：本回合給予受此牌支援的友軍單位+2|+1。",
    		descriptionRaw: "支援：本回合給予受此牌支援的友軍單位+2|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「皮克斯超棒的！他是個小不點，又酷，人又好。\n他最喜歡負鼠，嗯，還有還有……」——露璐",
    		artistName: "Dao Le",
    		name: "皮克斯！",
    		cardCode: "03IO017",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03IO008T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO008-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "本回合將1個侍從單位幻化為1|1<link=card.summon><style=AssociatedCard>小松鼠</style></link>及<link=vocab.Silence><style=Vocab>沉默</style></link>。",
    		descriptionRaw: "本回合將1個侍從單位幻化為1|1小松鼠及沉默。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「變可愛！」——露璐",
    		artistName: "Kudos Productions",
    		name: "幻想曲！",
    		cardCode: "03IO008",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO008T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO008T1-full.png"
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
    		flavorText: "一道精靈閃光把他撞飛倒地！約德爾人消逝的笑聲傳入了他那對敏銳的新耳朵，他往下一看，看到的是一雙毛茸茸的爪子，以及毛茸茸的雙臂……",
    		artistName: "Dao Le",
    		name: "小松鼠",
    		cardCode: "03IO008T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO001-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 1,
    		health: 2,
    		description: "當此牌受到支援時，賦予此牌+2|+0。",
    		descriptionRaw: "當此牌受到支援時，賦予此牌+2|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "每個人都想要有一隻使魔，但沒有人願意負責。必須帶牠們去散步，確保牠們飲食均衡，還要訓練牠們，照顧牠們一點都不簡單。",
    		artistName: "SIXMOREVODKA",
    		name: "尋花松鼠",
    		cardCode: "03IO001",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO019-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 10,
    		health: 0,
    		description: "選擇1個友軍單位，\r\n<link=keyword.Recall><style=Keyword>召回</style></link>所有其他單位與地標。",
    		descriptionRaw: "選擇1個友軍單位，\r\n召回所有其他單位與地標。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我獨行我路。」——獨身修女",
    		artistName: "Kudos Productions",
    		name: "孤注一擲",
    		cardCode: "03IO019",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03IO002T1",
    			"03IO002T5",
    			"03IO008T1",
    			"03IO002T4"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO002-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 3,
    		health: 3,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：本回合受此牌支援的友軍單位成長到4|4。",
    		descriptionRaw: "支援：本回合受此牌支援的友軍單位成長到4|4。",
    		levelupDescription: "友軍單位受到<link=vocab.Support><style=Vocab>支援</style></link>3次或以上<style=Variable></style>。",
    		levelupDescriptionRaw: "友軍單位受到支援3次或以上。",
    		flavorText: "「皮克斯，別擔心！我們會脫離林地的，而且我們會把所有東西都『變可愛』！準備好了嗎？！」",
    		artistName: "SIXMOREVODKA",
    		name: "露璐",
    		cardCode: "03IO002",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO002T4.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO002T4-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "本回合給予1個友軍單位<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>或1個敵軍單位<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>。\r\n無法在戰鬥中施放，<br>或用來對應其他法術。",
    		descriptionRaw: "本回合給予1個友軍單位光盾或1個敵軍單位弱勢。\r\n無法在戰鬥中施放，或用來對應其他法術。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "小皮該保護……還是攻擊……？ ",
    		artistName: "Kudos Productions",
    		name: "帥啊小皮！",
    		cardCode: "03IO002T4",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03IO008T1",
    			"03IO002",
    			"03IO002T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO002T5.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO002T5-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "本回合將1個侍從單位幻化為1|1<link=card.summon><style=AssociatedCard>小松鼠</style></link>並<link=vocab.Silence><style=Vocab>沉默</style></link>該單位。將1張<link=card.level1><style=AssociatedCard>露璐</style></link>洗入我方牌組。",
    		descriptionRaw: "本回合將1個侍從單位幻化為1|1小松鼠並沉默該單位。將1張露璐洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「變可愛！」——露璐",
    		artistName: "Kudos Productions",
    		name: "露璐 幻想曲！",
    		cardCode: "03IO002T5",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03IO002T5",
    			"03IO002",
    			"03IO008T1",
    			"03IO002T4"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO002T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO002T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 3,
    		health: 4,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：在手牌生成1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.create><style=AssociatedCard>帥啊小皮！</style></link>。\r\n<link=vocab.Support><style=Vocab>支援</style></link>：本回合受此牌支援的友軍單位成長到5|5。",
    		descriptionRaw: "回合開始：在手牌生成1張飛逝帥啊小皮！。\r\n支援：本回合受此牌支援的友軍單位成長到5|5。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「哇！皮克斯，你看！這個地方很新奇耶！我們也來為它增添色彩吧！」",
    		artistName: "SIXMOREVODKA",
    		name: "露璐",
    		cardCode: "03IO002T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO011-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 4,
    		health: 4,
    		description: "<link=vocab.Strike><style=Vocab>打擊</style></link>：使此牌力量值加倍。",
    		descriptionRaw: "打擊：使此牌力量值加倍。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "他之所以這麼壯，是因為他每天喝四杯橡果奶昔。",
    		artistName: "Dao Le",
    		name: "健壯松鼠",
    		cardCode: "03IO011",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO009-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 3,
    		health: 2,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "能量：104千焦耳(25大卡)；碳水化合物：5.88克；糖分：3.53克；膳食纖維：3克；脂肪：0.18克；蛋白質：0.98克；水：92克……",
    		artistName: "Dao Le",
    		name: "好吃精靈",
    		cardCode: "03IO009",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO003-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：賦予1個友軍單位<link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>。",
    		descriptionRaw: "出牌：賦予1個友軍單位隱密。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「噓，這邊！過了那個會走路的樹屋之後，我們得向左急轉彎，然後直走經過那些會說話的花朵。露璐，你有在聽嗎？露璐？露璐！露~璐！不。要。餵。它。們。」",
    		artistName: "Dao Le",
    		name: "嚮導精靈",
    		cardCode: "03IO003",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03IO007T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO007-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 3,
    		health: 3,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：生成1個攻擊中的<link=card.summon><style=AssociatedCard>夢中小鬼</style></link>，其能力值與受到此牌支援的友軍單位相同。",
    		descriptionRaw: "支援：生成1個攻擊中的夢中小鬼，其能力值與受到此牌支援的友軍單位相同。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "你應該在自己的床上作夢就好，不用一邊「夢飄」在魔法古森林裡，一邊漫不經心地喃喃唸著咒語，把夢境變成真的！",
    		artistName: "SIXMOREVODKA",
    		name: "瞌睡仙崔弗",
    		cardCode: "03IO007",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO007T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO007T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 3,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "另一隻夢中小鬼衝了出來，他狡詐的眼神充滿惡意。「不准再給崔弗起司了！」布莉嚷嚷著，其他人聽到後紛紛點頭。",
    		artistName: "SIXMOREVODKA",
    		name: "夢中小鬼",
    		cardCode: "03IO007T1",
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
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO010-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 2,
    		health: 1,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：本回合給予受此牌支援的友軍單位<link=keyword.Quick Strike><sprite name=QuickStrike><style=Keyword>快速攻擊</style></link>與+1|+0。",
    		descriptionRaw: "支援：本回合給予受此牌支援的友軍單位快速攻擊與+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "列貝利·蒙塔古爵士離鄉背井，心想完成偉大任務，或討好豪門世家。只不過造物弄人，命運帶領他走進班德爾之森，結果被年輕的布莉變成青蛙，並被迫陪伴她冒險，真可憐！",
    		artistName: "Dao Le",
    		name: "少女巫",
    		cardCode: "03IO010",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO020-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "阻止1個魔耗值等於或小於3的<link=keyword.Fast><sprite name=Fast><style=Keyword>快速</style></link>或<link=keyword.Slow><sprite name=Slow><style=Keyword>慢速</style></link>法術。",
    		descriptionRaw: "阻止1個魔耗值等於或小於3的快速或慢速法術。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「別這樣，你這個毛茸茸的傻瓜！你可能會傷到那些羚羊！」——露璐",
    		artistName: "Kudos Productions",
    		name: "抗拒！",
    		cardCode: "03IO020",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO022-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "<link=keyword.Recall><style=Keyword>召回</style></link>1個友軍單位，本回合其魔耗值降為0，並在原處召喚1個與之相同的<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>複製單位。",
    		descriptionRaw: "召回1個友軍單位，本回合其魔耗值降為0，並在原處召喚1個與之相同的閃靈複製單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "\"More\nKnow I got it，\nSo here you go，\nYou look like you could use some more.\"\n「我瞭\n你要更多\n拿去吧\n你看起來很缺。」\n——阿卡莉〈MORE〉",
    		artistName: "Kudos Productions",
    		name: "努力爭取",
    		cardCode: "03IO022",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03IO018-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "當此牌受到支援時，本回合給予此牌+0|+3。\r\n<link=vocab.Support><style=Vocab>支援</style></link>：本回合給予受此牌支援的友軍單位+3|+0。",
    		descriptionRaw: "當此牌受到支援時，本回合給予此牌+0|+3。\r\n支援：本回合給予受此牌支援的友軍單位+3|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "紫色精靈是一群可愛的小生物，牠們會被遇上的所有人照顧……除了一些例外。",
    		artistName: "Dao Le",
    		name: "毛茸茸保育員",
    		cardCode: "03IO018",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT005-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "抽1張地標牌或摧毀1個地標。",
    		descriptionRaw: "抽1張地標牌或摧毀1個地標。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "巨石峰瞬息萬變，堅硬之處會破碎，崩落之地卻能<br>復原。",
    		artistName: "Kudos Productions",
    		name: "分歧之路",
    		cardCode: "03MT005",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR009-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：在手牌隨機生成1張不存在於我方手牌、牌組或場上的升級後英雄。",
    		descriptionRaw: "回合開始：在手牌隨機生成1張不存在於我方手牌、牌組或場上的升級後英雄。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "受到未知的呼喚，英雄們來到這座橋上，面對刺骨寒風和搖搖欲墜的橋面，他們無一絲畏懼，只想知道未來的命運——不論是勝利或死亡。",
    		artistName: "SIXMOREVODKA",
    		name: "咆嘯深淵",
    		cardCode: "03FR009",
    		keywords: [
    			"地標"
    		],
    		keywordRefs: [
    			"LandmarkVisualOnly"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "地標",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI009-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：擊殺魔耗值最高的友軍單位，並從我方牌組召喚1個魔耗值高出1點的友軍單位。",
    		descriptionRaw: "回合開始：擊殺魔耗值最高的友軍單位，並從我方牌組召喚1個魔耗值高出1點的友軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "要引誘靈魂到這個鬼地方，有什麼能比承諾給予永生和無盡的財富來得有用呢？",
    		artistName: "SIXMOREVODKA",
    		name: "希利亞寶庫",
    		cardCode: "03SI009",
    		keywords: [
    			"地標"
    		],
    		keywordRefs: [
    			"LandmarkVisualOnly"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "地標",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT052.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT052-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "<link=vocab.RoundEnd><style=Vocab>回合結束</style></link>：治癒所有負傷友軍單位1點生命。此牌在場上時，若我方治癒友軍單位22點或以上生命，即贏下牌局。<style=Variable></style>",
    		descriptionRaw: "回合結束：治癒所有負傷友軍單位1點生命。此牌在場上時，若我方治癒友軍單位22點或以上生命，即贏下牌局。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「聖流之上，\n水池深處，治癒之泉\n閃耀之光，微明之水，\n聆聽河流之歌，\n水晶山脈之巔。」\n——〈獺人詩篇〉",
    		artistName: "SIXMOREVODKA",
    		name: "星泉",
    		cardCode: "03MT052",
    		keywords: [
    			"地標"
    		],
    		keywordRefs: [
    			"LandmarkVisualOnly"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "地標",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03NX013.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03NX013-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "擊殺1個負傷單位或摧毀<br>1個地標。",
    		descriptionRaw: "擊殺1個負傷單位或摧毀1個地標。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「龍犬聞到味道了，牠們會找到她，然後做個了結，除此之外別無他法。」——獵捕手亞瑞爾",
    		artistName: "Kudos Productions",
    		name: "焦土作戰",
    		cardCode: "03NX013",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03NX004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03NX004-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "<link=vocab.RoundEnd><style=Vocab>回合結束</style></link>：使1個<link=vocab.Strongest><style=Vocab>最強</style></link>友軍單位與1個<link=keyword.Weakest><style=Keyword>最弱</style></link>敵軍單位互相<link=vocab.Strike><style=Vocab>打擊</style></link>。",
    		descriptionRaw: "回合結束：使1個最強友軍單位與1個最弱敵軍單位互相打擊。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「哈囉，各位角鬥競技迷，你們準備好迎接烈火之環最火燙刺激的夜晚了嗎？哇，看來小崔克今天抽到了籤王，他要對決強大的戰士葛納——克大王！醫護人士請到場邊待命，這場很快就會結束！」——競技場主持人",
    		artistName: "SIXMOREVODKA",
    		name: "諾薩克拉亞競技場",
    		cardCode: "03NX004",
    		keywords: [
    			"地標"
    		],
    		keywordRefs: [
    			"LandmarkVisualOnly"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "地標",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT005T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT005T2-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "摧毀1個地標。",
    		descriptionRaw: "摧毀1個地標。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "每座山峰都在他們面前崩落，讓他們的腳步更穩定，意志更堅決。他們一定會登上巨石峰。",
    		artistName: "Kudos Productions",
    		name: "毀滅之路",
    		cardCode: "03MT005T2",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT005T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03MT005T1-full.png"
    			}
    		],
    		region: "巨石峰",
    		regionRef: "Targon",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "抽1張地標。",
    		descriptionRaw: "抽1張地標。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "山峰連綿不絕，不過他們有前進不懈的精神。他們一定會成功翻越巨石峰的。",
    		artistName: "Kudos Productions",
    		name: "探索之路",
    		cardCode: "03MT005T1",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03SI008-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "擊殺1個友軍單位，以擊殺1個單位或摧毀1個地標。",
    		descriptionRaw: "擊殺1個友軍單位，以擊殺1個單位或摧毀1個地標。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "這些鬼島上沒有永恆之物，一切都將終結。",
    		artistName: "Kudos Productions",
    		name: "同命",
    		cardCode: "03SI008",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03PZ001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03PZ001-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：棄置我方手牌，接著在手牌隨機生成3張牌，並賦予其<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。",
    		descriptionRaw: "回合開始：棄置我方手牌，接著在手牌隨機生成3張牌，並賦予其飛逝。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "賽爾·畢·漢默丁格教授的發明讓他出了名，但卻是他生動的講課風格，以及難以預測的可怕教學示範，讓皮爾托福的聰明人士心中留下了難以磨滅的印象。",
    		artistName: "SIXMOREVODKA",
    		name: "皮爾托福大學",
    		cardCode: "03PZ001",
    		keywords: [
    			"地標"
    		],
    		keywordRefs: [
    			"LandmarkVisualOnly"
    		],
    		spellSpeed: "",
    		spellSpeedRef: "",
    		rarity: "史詩",
    		rarityRef: "Epic",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "地標",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR007-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 1,
    		cost: 2,
    		health: 3,
    		description: "召喚此牌時，若我方<link=vocab.Behold><style=Vocab>掌控</style></link>魔耗值8點或以上的卡牌，則賦予此牌+3|+0。",
    		descriptionRaw: "召喚此牌時，若我方掌控魔耗值8點或以上的卡牌，則賦予此牌+3|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "斥候蹲在一塊埋藏在雪下的爛布前，寒冷的空氣混雜著人汗和火煙的臭味。\n他把爛布拉出來，並看到有一個護符吊在其中一角。護符在烏雲密布的天空下顯得黯然無光，但他還是認出這個護符的產地：艾伐洛森。 ",
    		artistName: "Wild Blue Studio",
    		name: "拾荒巨魔",
    		cardCode: "03FR007",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR004-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "挑選手牌中的1個單位進行揭示，並為我方主堡恢復等同其力量值的生命。\r\n<link=keyword.Enlightened><style=Keyword>開悟</style></link>：使該牌魔耗值降為0點。",
    		descriptionRaw: "挑選手牌中的1個單位進行揭示，並為我方主堡恢復等同其力量值的生命。\r\n開悟：使該牌魔耗值降為0點。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「成年巨魔皮厚骨硬，且傷口會迅速痊癒，是一群頑強的敵人。要俐落了斷他們的性命，否則他們不久就會痊癒歸來。」——艾伐洛森神射手",
    		artistName: "Kudos Productions",
    		name: "復甦咆嘯",
    		cardCode: "03FR004",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR017-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 5,
    		cost: 6,
    		health: 5,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：若我方<link=vocab.Behold><style=Vocab>掌控</style></link>魔耗值8點或以上的卡牌，則賦予1個友軍單位<link=keyword.Overwhelm><sprite name=Overwhelm><style=Keyword>勢不可擋</style></link>與<link=keyword.Regeneration><sprite name=Regeneration><style=Keyword>再生</style></link>。",
    		descriptionRaw: "出牌：若我方掌控魔耗值8點或以上的卡牌，則賦予1個友軍單位勢不可擋與再生。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "據說懂得古神之歌的巨魔不多，但學會便能呼喚祖先之名，賦予同胞驚人力量。",
    		artistName: "Kudos Productions",
    		name: "古魔占卜師",
    		cardCode: "03FR017",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03FR006T1",
    			"03FR006T3",
    			"03FR006T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR006-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 4,
    		cost: 5,
    		health: 5,
    		description: "召喚此牌時，在手牌生成1張<br><link=card.create><style=AssociatedCard>通天冰柱</style></link>。",
    		descriptionRaw: "召喚此牌時，在手牌生成1張通天冰柱。",
    		levelupDescription: "此牌在場上時，我方打出<br><link=card.create><style=AssociatedCard>通天冰柱</style></link>。",
    		levelupDescriptionRaw: "此牌在場上時，我方打出通天冰柱。",
    		flavorText: "火把接二連三點起，點亮了整條小徑。那裡站著幾十甚至上百隻巨魔，每隻都身軀龐大，殺氣騰騰。\n「我再問一次，」特朗德大聲咆哮，並把凍骨者托在肩上。「你們要投降，還是要我敲破你們的腦袋？」",
    		artistName: "SIXMOREVODKA",
    		name: "特朗德",
    		cardCode: "03FR006",
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
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03FR006T1",
    			"03FR006T3",
    			"03FR006"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR006T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR006T2-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 5,
    		cost: 5,
    		health: 6,
    		description: "召喚此牌時，在手牌生成1張<br><link=card.create><style=AssociatedCard>通天冰柱</style></link>。\r\n<link=vocab.Attack><style=Vocab>攻擊</style></link>：我方每<link=vocab.Behold><style=Vocab>掌控</style></link>1張魔耗值8點或以上的卡牌，則賦予此牌+1|+0。",
    		descriptionRaw: "召喚此牌時，在手牌生成1張通天冰柱。\r\n攻擊：我方每掌控1張魔耗值8點或以上的卡牌，則賦予此牌+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "聽到艾伐洛森人拒絕後，特朗德打了個手勢，巨魔便排山倒海地衝前，直闖艾伐洛森部落的深處，毫無顧忌地破壞任何擋路的東西。",
    		artistName: "SIXMOREVODKA",
    		name: "特朗德",
    		cardCode: "03FR006T2",
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
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "英雄",
    		type: "單位",
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03FR006T1",
    			"03FR006",
    			"03FR006T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR006T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR006T3-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "本回合給予所有單位-3|-0，並對所有單位造成3點傷害。\r\n將1張<link=card.level1><style=AssociatedCard>特朗德</style></link>洗入我方牌組。",
    		descriptionRaw: "本回合給予所有單位-3|-0，並對所有單位造成3點傷害。\r\n將1張特朗德洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「把他們統統活埋！」——特朗德",
    		artistName: "Kudos Productions",
    		name: "特朗德 地裂冰川",
    		cardCode: "03FR006T3",
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR006T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR006T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 8,
    		health: 6,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：恢復8點魔力。\r\n<link=vocab.Play><style=Vocab>出牌</style></link>及<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：本回合給予<link=vocab.Strongest><style=Vocab>最強</style></link>敵軍單位<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>。",
    		descriptionRaw: "出牌：恢復8點魔力。\r\n出牌及回合開始：本回合給予最強敵軍單位弱勢。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「哈哈，沒想到吧！」——特朗德",
    		artistName: "Kudos Productions",
    		name: "通天冰柱",
    		cardCode: "03FR006T1",
    		keywords: [
    			"弱勢"
    		],
    		keywordRefs: [
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
    		collectible: false,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR008-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "本回合給予所有單位-3|-0，並對所有單位造成3點傷害。",
    		descriptionRaw: "本回合給予所有單位-3|-0，並對所有單位造成3點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「把他們統統活埋！」——特朗德",
    		artistName: "Kudos Productions",
    		name: "地裂冰川",
    		cardCode: "03FR008",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR002-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "本回合給予1個友軍單位+0|+2，並給予1個敵軍單位<br>-2|-0。",
    		descriptionRaw: "本回合給予1個友軍單位+0|+2，並給予1個敵軍單位-2|-0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "巨魔戰歌的種類繁多，不同部落各有特色，且往往難以理解，不過它們都有一個相同之處，就是必定會令聽者膽顫心寒。 ",
    		artistName: "Kudos Productions",
    		name: "巨魔戰歌",
    		cardCode: "03FR002",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR011-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 7,
    		cost: 8,
    		health: 7,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "聽到聲音前，他們便先感覺到了——大地在他們腳下震動，如雷巨響也隨即而來。\n梅里克抬起頭來，豎起耳朵，仔細聆聽。\n「是什麼東西？」安雅一邊連忙悄悄問道，一邊拉弓，但梅里克已經在跑回小徑了。\n「快跑！」",
    		artistName: "MAR Studio",
    		name: "遠古巨魔烏孜珈",
    		cardCode: "03FR011",
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
    		rarity: "稀有",
    		rarityRef: "Rare",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR005-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 4,
    		health: 5,
    		description: "召喚此牌時，若我方<link=vocab.Behold><style=Vocab>掌控</style></link>魔耗值8點或以上的卡牌，則賦予此牌<br><link=keyword.Regeneration><sprite name=Regeneration><style=Keyword>再生</style></link>。",
    		descriptionRaw: "召喚此牌時，若我方掌控魔耗值8點或以上的卡牌，則賦予此牌再生。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "當他們到了艾伐洛森木屋群的時候，便呼喚海格上前。她大聲一笑，舉起了她的武器「雪裂者」，預備把木屋敲成木碎。",
    		artistName: "MAR Studio",
    		name: "破壞狂巨魔",
    		cardCode: "03FR005",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR018-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "從我方牌組最上方4張牌中，抽出每張雪怪、普羅與厄努克，然後將其餘卡牌洗回我方牌組。",
    		descriptionRaw: "從我方牌組最上方4張牌中，抽出每張雪怪、普羅與厄努克，然後將其餘卡牌洗回我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「然後一隻超~巨大的厄努克從樹後衝出來，上面騎著一隻超~小的普羅，然後還有一隻友善的雪怪，他們想跟朋友一起玩，所以就大喊『哇啊啊啊啊』，一起跑下山，然後……」——青年英格瓦",
    		artistName: "Kudos Productions",
    		name: "野性呼喚",
    		cardCode: "03FR018",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR010-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：若我方<link=vocab.Behold><style=Vocab>掌控</style></link>魔耗值8點或以上的卡牌，本回合額外獲得1顆魔力寶石。",
    		descriptionRaw: "回合開始：若我方掌控魔耗值8點或以上的卡牌，本回合額外獲得1顆魔力寶石。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「起來吧，眾大古魔，起來吧！\n冰雪支配者，劃破天空吧！\n起來吧，眾大古魔，起來吧！\n賜我們力量，則他們死亡！」\n——巨魔戰歌",
    		artistName: "Wild Blue Studio",
    		name: "古魔頭首",
    		cardCode: "03FR010",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR019-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "獲得2個魔力寶石槽位。\r\n從我方牌組最上方的4張牌中，抽出所有魔耗值8點或以上的牌，然後將其餘卡牌洗回我方牌組。",
    		descriptionRaw: "獲得2個魔力寶石槽位。\r\n從我方牌組最上方的4張牌中，抽出所有魔耗值8點或以上的牌，然後將其餘卡牌洗回我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "世代以來，艾伐洛森開拓者總會在冬季的暴風聲中聽到難以解釋的奇怪聲音。後來，當他們向北方更遠處探索時，終於發現聲音的來源——遠古的巨魔石雕。當風吹過其張開的嘴巴時，就會用早已失傳的語言呢喃出聲。",
    		artistName: "Kudos Productions",
    		name: "古魔之聲",
    		cardCode: "03FR019",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03FR022-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 12,
    		health: 0,
    		description: "從手牌和牌組中<br>隨機召喚2個不同的英雄單位，<br>並使其能力值升至10 |10。",
    		descriptionRaw: "從手牌和牌組中隨機召喚2個不同的英雄單位，並使其能力值升至10 |10。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "\"We got it all in our hands now\nSo can you handle what we're all about?\"\n「我們掌握了一切\n看你能不能應付我們的威？」\n——阿璃〈POP/STARS〉",
    		artistName: "Kudos Productions",
    		name: "猛烈攻勢",
    		cardCode: "03FR022",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX038"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03NX018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03NX018-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>1個敵軍單位。\r\n若我方場上有<link=card.champ1><style=AssociatedCard>達瑞斯</style></link>，<br>則進行<link=vocab.Rally><style=Vocab>備戰</style></link>。",
    		descriptionRaw: "擊暈1個敵軍單位。\r\n若我方場上有達瑞斯，則進行備戰。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我自己來就行了。」——達瑞斯",
    		artistName: "Kudos Productions",
    		name: "壓制",
    		cardCode: "03NX018",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"03NX016"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03NX017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03NX017-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 7,
    		cost: 7,
    		health: 4,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：對1個友軍單位與1個敵軍單位造成1點傷害4次。",
    		descriptionRaw: "出牌：對1個友軍單位與1個敵軍單位造成1點傷害4次。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "戰鬥前幾天，巨異蜥馴獸師不會讓牠們吃活的獵物。等到那些猛獸被釋放時，牠們會變得不分敵友，並且所向無敵。",
    		artistName: "Kudos Productions",
    		name: "巨異蜥血魔",
    		cardCode: "03NX017",
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
    		collectible: true,
    		set: "Set3"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03NX016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set3/zh_tw/img/cards/03NX016-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對1個友軍單位與1個敵軍單位造成1點傷害4次。",
    		descriptionRaw: "對1個友軍單位與1個敵軍單位造成1點傷害4次。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「你要小心的不是猛獸的利爪，而是牠們永遠無法滿足的胃口。」——巨異蜥馴獸師",
    		artistName: "Kudos Productions",
    		name: "利爪擊",
    		cardCode: "03NX016",
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
    		collectible: false,
    		set: "Set3"
    	}
    ];

    var set2 = [
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ001-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 5,
    		health: 5,
    		description: "召喚此牌時抽1張牌。\r\n若我方已打出至少10張<br>名稱不重複的其他卡牌，<br>則賦予此牌+4|+0。<style=Variable></style>",
    		descriptionRaw: "召喚此牌時抽1張牌。\r\n若我方已打出至少10張名稱不重複的其他卡牌，則賦予此牌+4|+0。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ010-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ006-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "抽到此牌時，<br>此牌本回合魔耗值-2。\r\n對1個單位造成3點傷害。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ004-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ007-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "當我方打出1張魔耗值2點的卡牌，<br>抽1張牌，並給予其<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。",
    		descriptionRaw: "當我方打出1張魔耗值2點的卡牌，抽1張牌，並給予其飛逝。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ002-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 5,
    		cost: 6,
    		health: 6,
    		description: "我方抽牌時，給予其<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>，<br>並於手牌生成1張該牌的複製牌。",
    		descriptionRaw: "我方抽牌時，給予其飛逝，並於手牌生成1張該牌的複製牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "年僅五歲，她便製作了世上第一把的多周波震動刀。這把刀雖然不是很實用（通常她只是用來切三明治），但還是幫她得到了警備隊菁英裝備部門的<br>職位。",
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
    		collectible: true,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ008-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 5,
    		health: 4,
    		description: "無論此牌在場上或在手牌中，<br>我方每打出其他牌，<br>即賦予此牌+1|+0（最多+8|+0）。<style=Variable></style>",
    		descriptionRaw: "無論此牌在場上或在手牌中，我方每打出其他牌，即賦予此牌+1|+0（最多+8|+0）。",
    		levelupDescription: "此牌單次<link=vocab.Strike><style=Vocab>打擊</style></link><br>造成10點或以上傷害。",
    		levelupDescriptionRaw: "此牌單次打擊造成10點或以上傷害。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ009-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "在手牌生成1張魔耗值2、<br>來自我方牌組區域的卡牌，<br>本回合其魔耗值降為0。",
    		descriptionRaw: "在手牌生成1張魔耗值2、來自我方牌組區域的卡牌，本回合其魔耗值降為0。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ003-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "抽到此牌時，<br>此牌本回合魔耗值-2。\r\n將1個友軍單位能力值變成4|4。",
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
    		collectible: true,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ008T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ008T2-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 10,
    		cost: 5,
    		health: 5,
    		description: "此牌在攻擊時，每<link=vocab.Strike><style=Vocab>打擊</style></link>1個單位，<br>就對敵方主堡造成5點傷害。",
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
    		collectible: false,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ008T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ008T1-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02PZ005-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 4,
    		cost: 3,
    		health: 3,
    		description: "抽到此牌時，<br>本回合此牌魔耗值-1。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW040.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW040-full.png"
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
    		flavorText: "「我最擅長命今平民白性，環有從不寫錯字」<br>——寫在沙上的留言",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW057.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW057-full.png"
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
    		flavorText: "「船長，我發誓我在珊瑚礁那邊看到了史上最奇怪的景象！那個笨蛋往橘子裡塞了什麼鬼啊，<br>我一直在想……」——肖狗水手",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW041.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW041-full.png"
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW013.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW013-full.png"
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW034T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW034.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW034-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 5,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：對此牌造成2點傷害<br>並召喚1個<link=card.create><style=AssociatedCard>火藥猴群</style></link>。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW034T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW034T1-full.png"
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
    		flavorText: "「真是一群調皮鬼，你說是吧？其實他們還挺幫得上忙的，只不過有人說他們脾氣火爆……」<br>——賽蓮號水手",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW056T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW056.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW056-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 6,
    		health: 4,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：<link=keyword.Obliterate><style=Keyword>泯滅</style></link>1個<br>生命值低於此牌的敵軍單位。\r\n<style=Variable></style>",
    		descriptionRaw: "出牌：泯滅1個生命值低於此牌的敵軍單位。\r\n",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「有一天我踏上小船，\n遠離比爾吉沃特灣。\n突然刮起狂風大浪，\n深海女王從海浮上……」 <br>——〈翼耳深海女王民謠〉",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW056T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW056T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "<link=keyword.Obliterate><style=Keyword>泯滅</style></link>1個<br>生命值低於此牌的敵軍單位。",
    		descriptionRaw: "泯滅1個生命值低於此牌的敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「她將我人船併吞，\n使我在肚裡受困。\n現在我只能高歌，\n自己的命運坎坷。」<br>——〈翼耳深海女王民謠〉",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW060T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW060.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW060-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 1,
    		cost: 1,
    		health: 2,
    		description: "友軍攻擊時，<br>對敵方主堡造成1點傷害。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW020"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW011-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Allegiance><style=Vocab>效忠</style></link>：<link=keyword.Nab><style=Keyword>奪取</style></link>1張牌，<br>並在手牌生成1張<link=card.create><style=AssociatedCard>警告射擊</style></link>。",
    		descriptionRaw: "效忠：奪取1張牌，並在手牌生成1張警告射擊。",
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
    		collectible: true,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW030.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW030-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 7,
    		cost: 7,
    		health: 5,
    		description: "召喚此牌時，<link=vocab.Toss><style=Vocab>亂擲</style></link>2張牌，<br>並把2張寶藏牌洗入我方牌組。\r\n<style=Variable></style>",
    		descriptionRaw: "召喚此牌時，亂擲2張牌，並把2張寶藏牌洗入我方牌組。\r\n",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW030T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW030T2-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "此牌遭到<link=vocab.Toss><style=Vocab>亂擲</style></link>時，<br>反而會被抽出。\r\n對所有單位造成5點傷害。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW030T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW030T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "隨機在手牌生成5張<br>魔耗值0點的<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>卡牌。\r\n此牌遭到<link=vocab.Toss><style=Vocab>亂擲</style></link>時，反而會被抽出。",
    		descriptionRaw: "隨機在手牌生成5張魔耗值0點的飛逝卡牌。\r\n此牌遭到亂擲時，反而會被抽出。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW030T4.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW030T4-full.png"
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW030T4"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW030T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW030T3-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "此牌遭到<link=vocab.Toss><style=Vocab>亂擲</style></link>時，<br>反而會被抽出。\r\n召喚3個<link=card.summon><style=AssociatedCard>兇惡鎧龍</style></link>。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW019-full.png"
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW007-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 4,
    		health: 5,
    		description: "棄置2張牌即可出此牌。\r\n<link=vocab.Attack><style=Vocab>攻擊</style></link>：抽2張牌，並給予其<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。",
    		descriptionRaw: "棄置2張牌即可出此牌。\r\n攻擊：抽2張牌，並給予其飛逝。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW014-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 1,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，<br>生成1張魔耗值1點、<br>來自我方牌組區域的法術。",
    		descriptionRaw: "召喚此牌時，生成1張魔耗值1點、來自我方牌組區域的法術。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW055.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW055-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：<br>賦予<link=vocab.Everywhere><style=Vocab>各處</style></link>魔耗值1的友軍單位+1|+0。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW017-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 6,
    		health: 5,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：治癒所有友軍單位及<br>我方主堡3點生命，<br>然後進行<link=vocab.Rally><style=Vocab>備戰</style></link>。\r\n",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW038.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW038-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 4,
    		health: 2,
    		description: "召喚此牌時，從我方牌組抽出1張<br>魔耗值3點或以下的法術牌。",
    		descriptionRaw: "召喚此牌時，從我方牌組抽出1張魔耗值3點或以下的法術牌。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW021.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW021-full.png"
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW035.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW035-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 6,
    		cost: 6,
    		health: 5,
    		description: "召喚此牌時，<br>賦予所有敵軍單位<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW058.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW058-full.png"
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW028T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW028.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW028-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 6,
    		cost: 8,
    		health: 4,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：對敵軍單位隨機施放6次<link=card.cast><style=AssociatedCard>加農炮幕</style></link>。",
    		descriptionRaw: "洗劫：對敵軍單位隨機施放6次加農炮幕。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「駛過水手，駛過殘骸，\n打鬥告終。\n霧氣消散後，船長遇見了雷克斯，\n船身於是支離破碎，成為斷裂的浮木。」<br>——〈水手家之心〉",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW028T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW028T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對1個單位造成2點傷害。\r\n若該單位陣亡或離開場上，<br>則改為對敵方主堡造成1點傷害。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW037.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW037-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 5,
    		health: 3,
    		description: "<link=vocab.NexusStrike><style=Vocab>打擊主堡</style></link>：抽1張牌。\r\n<style=Variable></style>",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW008-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 3,
    		health: 1,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：召喚1個<link=card.summon><style=AssociatedCard>火藥桶</style></link>，<br>或隨機召喚1個<br>魔耗值1點的侍從單位。",
    		descriptionRaw: "出牌：召喚1個火藥桶，或隨機召喚1個魔耗值1點的侍從單位。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW008T02.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW008T02-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 3,
    		health: 1,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<br>隨機召喚1個魔耗值1點的侍從單位。",
    		descriptionRaw: "出牌：隨機召喚1個魔耗值1點的侍從單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "他後來總算懂了，除了點燃的引線外，很少有東西能逼得打混水手認真幹活。",
    		artistName: "SIXMOREVODKA",
    		name: "肖狗水手",
    		cardCode: "02BW008T02",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW008T01.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW008T01-full.png"
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
    		flavorText: "他後來總算懂了，除了點燃的引線外，很少有東西能逼得打混水手認真幹活。",
    		artistName: "SIXMOREVODKA",
    		name: "肖狗水手",
    		cardCode: "02BW008T01",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW047.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW047-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 1,
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW004-full.png"
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW002-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 9,
    		health: 8,
    		description: "使我方技能、法術與友軍單位造成的所有傷害加倍。\r\n<link=vocab.Play><style=Vocab>出牌</style></link>：抽出1張<link=card.champ1><style=AssociatedCard>剛普朗克</style></link>。",
    		descriptionRaw: "使我方技能、法術與友軍單位造成的所有傷害加倍。\r\n出牌：抽出1張剛普朗克。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW016-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 1,
    		cost: 3,
    		health: 4,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：上回合我方每抽1張牌，<br>則賦予此牌+0|+1，<br>然後隨機分配其能力值。\r\n<style=Variable></style>",
    		descriptionRaw: "回合開始：上回合我方每抽1張牌，則賦予此牌+0|+1，然後隨機分配其能力值。\r\n",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW036"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW027.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW027-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 6,
    		cost: 4,
    		health: 6,
    		description: "召喚此牌時，<br>為敵方召喚1個<link=card.summon><style=AssociatedCard>黃金獨角鯨</style></link>。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW050.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW050-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 7,
    		health: 4,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：<br>使手牌與牌組中友軍魔耗值-2。",
    		descriptionRaw: "洗劫：使手牌與牌組中友軍魔耗值-2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「快跟我們踏上一場音樂之旅！欣賞符文大地各地的美妙旋律！謹記付費入場，還有給些小費……」<br>——表演宣傳人員",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW022"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW015.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW015-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 7,
    		health: 7,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：抽出1張<link=card.champ1><style=AssociatedCard>好運姐</style></link>。\r\n此牌攻擊時，我方所有法術/技能<br>額外造成1點傷害。",
    		descriptionRaw: "出牌：抽出1張好運姐。\r\n此牌攻擊時，我方所有法術/技能額外造成1點傷害。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW010-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：隨機賦予此牌2種特性。",
    		descriptionRaw: "洗劫：隨機賦予此牌2種特性。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW009-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 1,
    		cost: 1,
    		health: 2,
    		description: "召喚此牌後，<br>於下次<link=vocab.RoundStart><style=Vocab>回合開始</style></link>抽1張牌，<br>並給予其<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。",
    		descriptionRaw: "召喚此牌後，於下次回合開始抽1張牌，並給予其飛逝。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW005-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "召喚此牌時，賦予<link=vocab.Strongest><style=Vocab>最強</style></link>敵軍單位<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>。",
    		descriptionRaw: "召喚此牌時，賦予最強敵軍單位弱勢。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW039.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW039-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 3,
    		health: 1,
    		description: "召喚此牌時，<br>在手牌生成1張隨機海怪牌。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW006-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 4,
    		health: 2,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：幻化1個友軍單位，<br>隨機變成魔耗值5點的侍從單位。",
    		descriptionRaw: "出牌：幻化1個友軍單位，隨機變成魔耗值5點的侍從單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「厲不厲害？我的……我的手上哪了？」\n「看好啦，我要再把它們變出來！<br>搭啦！咳咳……搭啦！」\n「……我天殺的手去哪啦？！」\n「好吧，感謝觀看，你們該滾了！」",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW036.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW036-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 2,
    		health: 3,
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW033.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW033-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 2,
    		health: 1,
    		description: "抽出的敵方卡牌魔耗值-1。\r\n<link=vocab.Plunder><style=Vocab>洗劫</style></link>：<link=keyword.Nab><style=Keyword>奪取</style></link>1張牌。",
    		descriptionRaw: "抽出的敵方卡牌魔耗值-1。\r\n洗劫：奪取1張牌。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW060T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW060T1-full.png"
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
    		collectible: false,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW032.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW032-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 5,
    		cost: 5,
    		health: 5,
    		description: "召喚此牌時，召喚1個<link=card.summon><style=AssociatedCard>火藥桶</style></link>。",
    		descriptionRaw: "召喚此牌時，召喚1個火藥桶。",
    		levelupDescription: "我方對敵方主堡<br>造成傷害累計5回合<style=Variable></style>。",
    		levelupDescriptionRaw: "我方對敵方主堡造成傷害累計5回合。",
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
    		collectible: true,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW032T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW032T2-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "對任1目標造成1點傷害。\r\n若擊殺該單位，<br>則另外對敵方主堡造成1點傷害。\r\n將1張<link=card.level1><style=AssociatedCard>剛普朗克</style></link>洗入我方牌組。",
    		descriptionRaw: "對任1目標造成1點傷害。\r\n若擊殺該單位，則另外對敵方主堡造成1點傷害。\r\n將1張剛普朗克洗入我方牌組。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032T1",
    			"02BW032T4",
    			"02BW032",
    			"02BW032T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW032T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW032T3-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 6,
    		cost: 5,
    		health: 6,
    		description: "召喚此牌時及<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：<br>召喚1個<link=card.summon><style=AssociatedCard>火藥桶</style></link>。\r\n<link=keyword.AttackSkillMark><sprite name=AttackSkillMark><style=Keyword>攻擊</style></link>：對所有敵軍單位及<br>敵方主堡造成1點傷害。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW032T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW032T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 1,
    		description: "火藥桶可疊加。\r\n使我方所有法術/技能傷害增加<style=Variable>1</style>點。\r\n一旦使用法術/技能對敵軍單位<br>或敵方主堡造成傷害後，<br>此牌便會遭到銷毀。",
    		descriptionRaw: "火藥桶可疊加。\r\n使我方所有法術/技能傷害增加1點。\r\n一旦使用法術/技能對敵軍單位或敵方主堡造成傷害後，此牌便會遭到銷毀。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW032T4.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW032T4-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對所有敵軍單位與敵方主堡<br>造成1點傷害。",
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
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW022T4",
    			"02BW022T3",
    			"02BW022T2",
    			"02BW022T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW022-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "友軍單位攻擊時，<br>對所有戰鬥中敵軍單位與<br>敵方主堡造成1點傷害。",
    		descriptionRaw: "友軍單位攻擊時，對所有戰鬥中敵軍單位與敵方主堡造成1點傷害。",
    		levelupDescription: "此牌在場上時，<br>我方進行4次攻擊<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌在場上時，我方進行4次攻擊。",
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
    		collectible: true,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW022T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW022T3-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "在敵軍單位與敵方主堡中<br>隨機對3個不同目標造成1點傷害。<br>將1張<link=card.level1><style=AssociatedCard>好運姐</style></link>洗入我方牌組。",
    		descriptionRaw: "在敵軍單位與敵方主堡中隨機對3個不同目標造成1點傷害。將1張好運姐洗入我方牌組。",
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
    		collectible: false,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW022T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW022T2-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 4,
    		cost: 3,
    		health: 4,
    		description: "友軍單位攻擊時，<br>對所有戰鬥中敵軍單位與<br>敵方主堡造成1點傷害3次。",
    		descriptionRaw: "友軍單位攻擊時，對所有戰鬥中敵軍單位與敵方主堡造成1點傷害3次。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW022T4.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW022T4-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對所有戰鬥中敵軍單位與<br>敵方主堡造成1點傷害3次。",
    		descriptionRaw: "對所有戰鬥中敵軍單位與敵方主堡造成1點傷害3次。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW022T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW022T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對所有戰鬥中敵軍單位與<br>敵方主堡造成1點傷害。",
    		descriptionRaw: "對所有戰鬥中敵軍單位與敵方主堡造成1點傷害。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW046T3",
    			"02BW046T1",
    			"02BW025",
    			"02BW046T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW046.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW046-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "我方施放法術時，<br>使所有以此牌為目標的<br>法術/技能無效化，<br>並於本回合給予此牌<link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>。",
    		descriptionRaw: "我方施放法術時，使所有以此牌為目標的法術/技能無效化，並於本回合給予此牌隱密。",
    		levelupDescription: "我方施放6次法術<style=Variable></style>。",
    		levelupDescriptionRaw: "我方施放6次法術。",
    		flavorText: "比爾吉沃特的傳奇人物當中，飛斯的性格乖戾又難搞。一些水手將附近發生的無數船禍都怪罪於他……",
    		artistName: "SIXMOREVODKA",
    		name: "飛斯",
    		cardCode: "02BW046",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW046",
    			"02BW046T1",
    			"02BW025",
    			"02BW046T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW046T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW046T3-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 1,
    		health: 2,
    		description: "我方施放法術時，使所有以此牌為目標的法術/技能無效化，並於本回合給予此牌<link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>。\r\n<link=vocab.NexusStrike><style=Vocab>打擊主堡</style></link>：在手牌生成1張<br><link=card.create><style=AssociatedCard>海之霸主</style></link>。",
    		descriptionRaw: "我方施放法術時，使所有以此牌為目標的法術/技能無效化，並於本回合給予此牌隱密。\r\n打擊主堡：在手牌生成1張海之霸主。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "……其他人卻篤定地說這孩子只不過是貪玩，實際上常常護送人們安全回家。",
    		artistName: "SIXMOREVODKA",
    		name: "飛斯",
    		cardCode: "02BW046T3",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW046T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW046T2-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 5,
    		cost: 4,
    		health: 2,
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
    		collectible: false,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW046T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW046T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "從戰鬥中移除1個<br>攻擊中的友軍單位，<br>然後進行<link=vocab.Rally><style=Vocab>備戰</style></link>。\r\n將1張<link=card.level1><style=AssociatedCard>飛斯</style></link>洗入我方牌組。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW026T2",
    			"02BW026T4",
    			"02BW026T5",
    			"02BW026T3",
    			"02BW026T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW026.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW026-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 4,
    		health: 2,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：打出1張「命運」卡牌。",
    		descriptionRaw: "出牌：打出1張「命運」卡牌。",
    		levelupDescription: "此牌在場上時，<br>我方抽出8張或以上卡牌<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌在場上時，我方抽出8張或以上卡牌。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW026T5.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW026T5-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link><link=vocab.Strongest><style=Vocab>最強</style></link>敵軍單位，<br>並對其造成2點傷害。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW026",
    			"02BW026T1",
    			"02BW026T5",
    			"02BW026T4",
    			"02BW026T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW026T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW026T3-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "我方每打出1張牌，<br>則此牌打出1張「命運」，<br>每回合上限3次。",
    		descriptionRaw: "我方每打出1張牌，則此牌打出1張「命運」，每回合上限3次。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW026T3",
    			"02BW026"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW026T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW026T1-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "將1張手牌洗入我方牌組，<br>於下次<link=vocab.RoundStart><style=Vocab>回合開始</style></link>抽3張牌，<br>並給予其<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。\r\n將1張<link=card.level1><style=AssociatedCard>逆命</style></link>洗入我方牌組。",
    		descriptionRaw: "將1張手牌洗入我方牌組，於下次回合開始抽3張牌，並給予其飛逝。\r\n將1張逆命洗入我方牌組。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW026T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW026T2-full.png"
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW026T4.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW026T4-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對所有敵軍單位和敵方主堡<br>造成1點傷害。",
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
    		collectible: false,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW053.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW053-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 7,
    		health: 12,
    		description: "此牌升級時，<br>複製被<link=vocab.Toss><style=Vocab>亂擲</style></link>且魔耗值4點或以上的<br>友軍單位至我方牌組。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW053",
    			"02BW053T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW053T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW053T2-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>1個敵軍單位。\r\n若我方場上有<link=card.champCheck><style=AssociatedCard>納帝魯斯</style></link>，<br>則將該單位洗入敵方牌組。\r\n將1張<link=card.level1><style=AssociatedCard>納帝魯斯</style></link>洗入我方牌組。",
    		descriptionRaw: "擊暈1個敵軍單位。\r\n若我方場上有納帝魯斯，則將該單位洗入敵方牌組。\r\n將1張納帝魯斯洗入我方牌組。",
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
    		collectible: false,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW053T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW053T1-full.png"
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW061.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW061-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "抽到此牌時，<br>此牌本回合魔耗值-1。\r\n賦予1個友軍單位+2|+1。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW024.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW024-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "隨機召喚2個<br>魔耗值1點的侍從單位。",
    		descriptionRaw: "隨機召喚2個魔耗值1點的侍從單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「哎呀蓋夫，那不是我們在追的傢伙嗎？看來他多了一個同伴。」\n「巴茲，那……那是鯊魚人嗎？」\n「不管怎樣都是一大筆錢啦，對吧。」<br>——想賺錢的賞金獵人巴茲與蓋夫",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW003-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：<br>將場上的1個侍從單位<br>加入我方手牌。",
    		descriptionRaw: "洗劫：將場上的1個侍從單位加入我方手牌。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW046T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW025.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW025-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "賦予1個敵軍單位<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>，<br>然後召喚<link=card.summon><style=AssociatedCard>長牙獸</style></link>。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW032T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW012-full.png"
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW018-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "對任1目標造成1點傷害。\r\n若擊殺該單位，則另外對敵方主堡造成1點傷害。",
    		descriptionRaw: "對任1目標造成1點傷害。\r\n若擊殺該單位，則另外對敵方主堡造成1點傷害。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW048.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW048-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "隨機召喚1個<br>魔耗值1點的侍從單位。",
    		descriptionRaw: "隨機召喚1個魔耗值1點的侍從單位。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW043.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW043-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "將1張手牌洗入我方牌組，<br>於下次<link=vocab.RoundStart><style=Vocab>回合開始</style></link>抽3張牌，<br>並給予其<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>。",
    		descriptionRaw: "將1張手牌洗入我方牌組，於下次回合開始抽3張牌，並給予其飛逝。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW051.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW051-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "從戰鬥中移除1個<br>攻擊中的友軍單位，<br>然後進行<link=vocab.Rally><style=Vocab>備戰</style></link>。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02BW053"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW054.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW054-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>1個敵軍單位。\r\n若我方場上有<link=card.champCheck><style=AssociatedCard>納帝魯斯</style></link>，<br>則將該單位洗入敵方牌組。",
    		descriptionRaw: "擊暈1個敵軍單位。\r\n若我方場上有納帝魯斯，則將該單位洗入敵方牌組。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW042.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW042-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "本回合變更所有<br>友軍單位的力量值與生命值，<br>改為我方本牌局中<br>所打出的法術牌數量。<style=Variable></style>",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW059.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW059-full.png"
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
    		flavorText: "「能夠打沉敵人的，就是值得擁有的。」<br>——比爾吉沃特俗語",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW023.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW023-full.png"
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW031.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW031-full.png"
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW029.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW029-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "<link=vocab.Toss><style=Vocab>亂擲</style></link>2張牌，然後抽2張牌。",
    		descriptionRaw: "亂擲2張牌，然後抽2張牌。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW049.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW049-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "<link=keyword.Nab><style=Keyword>奪取</style></link>1張牌。\r\n<link=vocab.Plunder><style=Vocab>洗劫</style></link>：再<link=keyword.Nab><style=Keyword>奪取</style></link>1張。",
    		descriptionRaw: "奪取1張牌。\r\n洗劫：再奪取1張。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW001-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "本回合給予1個敵軍單位<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>，<br>若該單位於本回合陣亡，<br>則我方抽1張牌。",
    		descriptionRaw: "本回合給予1個敵軍單位弱勢，若該單位於本回合陣亡，則我方抽1張牌。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW063.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW063-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：<br>從敵方手牌隨機抽1張非英雄牌。",
    		descriptionRaw: "洗劫：從敵方手牌隨機抽1張非英雄牌。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW045.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW045-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "在敵軍單位與敵方主堡中<br>隨機對3個不同目標<br>造成1點傷害。",
    		descriptionRaw: "在敵軍單位與敵方主堡中隨機對3個不同目標造成1點傷害。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW020-full.png"
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW044.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW044-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "<link=vocab.Toss><style=Vocab>亂擲</style></link>4張牌。",
    		descriptionRaw: "亂擲4張牌。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW062.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02BW062-full.png"
    			}
    		],
    		region: "比爾吉沃特",
    		regionRef: "Bilgewater",
    		attack: 2,
    		cost: 4,
    		health: 4,
    		description: "召喚此牌時，隨機召喚1個<br>魔耗值1點的侍從單位，<br>並賦予其<link=keyword.Scout><sprite name=Scout><style=Keyword>先遣</style></link>。",
    		descriptionRaw: "召喚此牌時，隨機召喚1個魔耗值1點的侍從單位，並賦予其先遣。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「海蛇之母恩光普照，\n從海底直到雲霄。\n灰色天空凝視地上，\n平靜海面仿佛反射她的目光。\n她輕輕微笑，心靈安詳。」<br>——獻給娜葛卡布爾的禱告",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR009-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 4,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：獲得1個魔力寶石槽位。",
    		descriptionRaw: "洗劫：獲得1個魔力寶石槽位。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR004-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "本回合給予1個敵軍單位<br><link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>與<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>。",
    		descriptionRaw: "本回合給予1個敵軍單位凍傷與弱勢。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「這些溫血人在弗雷爾卓德活不過一天！」<br>——史瓦妮",
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
    		collectible: true,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR002-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 5,
    		cost: 6,
    		health: 6,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：本回合給予1個敵軍單位<br><link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>與<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>。 ",
    		descriptionRaw: "出牌：本回合給予1個敵軍單位凍傷與弱勢。 ",
    		levelupDescription: "我方對敵方主堡<br>造成傷害累計5回合<style=Variable></style>。",
    		levelupDescriptionRaw: "我方對敵方主堡造成傷害累計5回合。",
    		flavorText: "史瓦妮的冰星錘的確強大，不過她自己才是真正的武器：一把經歷過弗雷爾卓德艱苦寒冷磨練和試煉的<br>武器。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR001-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：<br>對所有目標造成1點傷害。",
    		descriptionRaw: "回合開始：對所有目標造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「他們努力耕田，\n默默撒種。\n我們隨心所欲，\n燒光一切！」<br>——冬之爪童謠",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02FR005T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR005-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 4,
    		cost: 5,
    		health: 6,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：<br>此牌幻化為<link=card.transform><style=AssociatedCard>風暴之爪巨熊</style></link>。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02FR005"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR005T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR005T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 6,
    		cost: 5,
    		health: 6,
    		description: "使其他力量值5點或以上的友軍單位<br>擁有<link=keyword.Overwhelm><sprite name=Overwhelm><style=Keyword>勢不可擋</style></link>。",
    		descriptionRaw: "使其他力量值5點或以上的友軍單位擁有勢不可擋。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "巨熊族捨棄了人性，完全釋放自己，駕馭雷暴之力。以閃電之姿穿越凍原，以雷吼之聲隆隆咆哮。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR010-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "賦予我方牌組<br>最上方3個單位+1|+1。\r\n<link=vocab.Plunder><style=Vocab>洗劫</style></link>：隨後抽出其中1張。",
    		descriptionRaw: "賦予我方牌組最上方3個單位+1|+1。\r\n洗劫：隨後抽出其中1張。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「有好東西要跟好朋友『分享』嘛。」<br>—— 無情劫掠者",
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
    		collectible: true,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR008-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 7,
    		cost: 8,
    		health: 7,
    		description: "<link=vocab.Plunder><style=Vocab>洗劫</style></link>：使我方牌組中單位的<br>力量值和生命值加倍。\r\n<link=vocab.Play><style=Vocab>出牌</style></link>：抽出1張<link=card.champ1><style=AssociatedCard>史瓦妮</style></link>。\r\n",
    		descriptionRaw: "洗劫：使我方牌組中單位的力量值和生命值加倍。\r\n出牌：抽出1張史瓦妮。\r\n",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「春天不只帶來適合種植的溫暖天氣，也會帶來劫盜船……本來數量繁多的糧食也會變得稀少。」<br>——艾伐洛森爐衛",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02FR002T3",
    			"02FR002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR002T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR002T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "本回合給予1個友軍單位+3|+4。\r\n將1張<link=card.level1><style=AssociatedCard>史瓦妮</style></link>洗入我方牌組。",
    		descriptionRaw: "本回合給予1個友軍單位+3|+4。\r\n將1張史瓦妮洗入我方牌組。",
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
    		collectible: false,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR002T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR002T3-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 6,
    		cost: 6,
    		health: 7,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：本回合給予1個敵軍單位<br><link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>與<link=keyword.Vulnerable><sprite name=Vulnerable><style=Keyword>弱勢</style></link>。\r\n每回合我方首次對敵方主堡<br>造成傷害時，<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>所有敵軍單位。",
    		descriptionRaw: "出牌：本回合給予1個敵軍單位凍傷與弱勢。\r\n每回合我方首次對敵方主堡造成傷害時，凍傷所有敵軍單位。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR007-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "本回合給予1個友軍單位+3|+4。",
    		descriptionRaw: "本回合給予1個友軍單位+3|+4。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR006-full.png"
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR016"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02FR003-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "在手牌生成2張隨機普羅牌<br>及2張<link=card.snaxRef><style=AssociatedCard>普羅點心</style></link>。",
    		descriptionRaw: "在手牌生成2張隨機普羅牌及2張普羅點心。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「當你仰望夜空，\n向普羅許願時，\n便會看到點心\n在群星之中閃閃發亮。」<br>——青年英格瓦",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02NX007"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX001-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 5,
    		cost: 8,
    		health: 8,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：抽出1張<link=card.champ1><style=AssociatedCard>斯溫</style></link>。\r\n<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：<br>對敵方主堡造成1點傷害3次。",
    		descriptionRaw: "出牌：抽出1張斯溫。\r\n回合開始：對敵方主堡造成1點傷害3次。",
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
    		collectible: true,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX007-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 5,
    		health: 6,
    		description: "<link=vocab.NexusStrike><style=Vocab>打擊主堡</style></link>：<br>對敵方主堡造成<style=Variable>3</style>點傷害。",
    		descriptionRaw: "打擊主堡：對敵方主堡造成3點傷害。",
    		levelupDescription: "我方造成12點非戰鬥傷害<style=Variable></style>。",
    		levelupDescriptionRaw: "我方造成12點非戰鬥傷害。",
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
    		collectible: true,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX007T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX007T2-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 4,
    		cost: 5,
    		health: 7,
    		description: "對敵方主堡造成非戰鬥傷害時，<br><link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>位於後排的<link=vocab.Strongest><style=Vocab>最強</style></link>敵軍單位。<br><link=vocab.NexusStrike><style=Vocab>打擊主堡</style></link>：<br>對所有敵軍單位及敵方主堡造成3點傷害。",
    		descriptionRaw: "對敵方主堡造成非戰鬥傷害時，擊暈位於後排的最強敵軍單位。打擊主堡：對所有敵軍單位及敵方主堡造成3點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「為了打下諾克薩斯的江山，任何犧牲都<br>在所不惜。」 ",
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
    		collectible: false,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX007T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX007T1-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "若該單位已負傷或遭到<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>，<br>則對其造成4點傷害。\r\n將1張<link=card.level1><style=AssociatedCard>斯溫</style></link>洗入牌組。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX006-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 4,
    		health: 5,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：<br>對敵方主堡造成1點傷害。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX002-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 6,
    		cost: 6,
    		health: 6,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：<br><link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>所有負傷敵軍單位。",
    		descriptionRaw: "攻擊：擊暈所有負傷敵軍單位。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX009-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "若該單位已負傷或遭到<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>，<br>則對其造成4點傷害。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02NX004T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX004-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：<br>對1個友軍單位造成1點傷害，<br>然後對敵方主堡造成2點傷害。",
    		descriptionRaw: "出牌：對1個友軍單位造成1點傷害，然後對敵方主堡造成2點傷害。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX003-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "對1個友軍單位造成3點傷害，<br>然後可對任1目標造成3點傷害。",
    		descriptionRaw: "對1個友軍單位造成3點傷害，然後可對任1目標造成3點傷害。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX010-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 6,
    		cost: 6,
    		health: 5,
    		description: "只有力量值5點或以上的敵軍單位<br>才能對此牌造成傷害。",
    		descriptionRaw: "只有力量值5點或以上的敵軍單位才能對此牌造成傷害。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX004T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX004T1-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對1個友軍單位造成1點傷害，<br>然後對敵方主堡造成2點傷害。",
    		descriptionRaw: "對1個友軍單位造成1點傷害，然後對敵方主堡造成2點傷害。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX008-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "對1個敵軍單位造成2點傷害，<br>並對敵方主堡造成1點傷害。",
    		descriptionRaw: "對1個敵軍單位造成2點傷害，並對敵方主堡造成1點傷害。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02NX005-full.png"
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
    		flavorText: "「只要有好的武器，攻城易如反掌。投石機能夠引誘他們出城；弩砲車則能夠將他們擊倒。」<br>——圍城技師",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE003-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE008-full.png"
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
    		flavorText: "新加入的遊俠會和夥伴在森林一同生活幾個月，學著了解巨角鹿的一舉一動。這項訓練需要耐心才能完成，不過一旦培養出默契與感情，就沒人能離間<br>他們。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE004-full.png"
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
    		artistName: "Rafael Zanchetin",
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
    		collectible: true,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE006-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 5,
    		health: 4,
    		description: "召喚此牌時，召喚<link=card.create><style=AssociatedCard>威洛</style></link>。",
    		descriptionRaw: "召喚此牌時，召喚威洛。",
    		levelupDescription: "此牌在場上時，<br>我方進行4次攻擊<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌在場上時，我方進行4次攻擊。",
    		flavorText: "「葵恩是一名勇敢無懼的遊騎兵，加上威洛在她身邊和天空中陪伴，這對拍檔無人能擋。」<br>——游騎兵珍妮薇·艾姆哈特",
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
    		collectible: true,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE006T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE006T3-full.png"
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE006T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE006T2-full.png"
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
    		collectible: false,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE006T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE006T1-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 5,
    		health: 5,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：召喚1個<link=card.create><style=AssociatedCard>威洛</style></link>，<br>該單位出場時<br>即<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰</style></link><link=vocab.Strongest><style=Vocab>最強</style></link>敵軍單位。",
    		descriptionRaw: "攻擊：召喚1個威洛，該單位出場時即挑戰最強敵軍單位。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02DE003"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE009-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE005-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "賦予1個友軍單位<br>「傷害及死亡免疫」。",
    		descriptionRaw: "賦予1個友軍單位「傷害及死亡免疫」。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "這名遊俠忍著腿上的劇痛，再度站起身來，高舉佩劍。她能夠再站起來，不只單靠自己的決心，還有整個蒂瑪西亞的意志在支撐著她。",
    		artistName: "Max Grecke",
    		name: "不屈靈魂",
    		cardCode: "02DE005",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02DE006T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE002-full.png"
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE010-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 5,
    		cost: 6,
    		health: 4,
    		description: "召喚此牌時，<br>本回合給予其他友軍單位+1|+1。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE007-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "本回合給予所有友軍單位<br><link=keyword.Tough><sprite name=Tough><style=Keyword>堅忍</style></link>。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02DE001-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "選擇1個敵軍單位，<br>使2個友軍單位<link=vocab.Strike><style=Vocab>打擊</style></link>該單位。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI005-full.png"
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI010-full.png"
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02SI008T1",
    			"02SI008T2",
    			"02SI008T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI008-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 1,
    		cost: 4,
    		health: 4,
    		description: "我方每回合首次打出友軍單位時，<br><link=vocab.Toss><style=Vocab>亂擲</style></link>2張牌並召喚1個<link=card.summon><style=AssociatedCard>小樹精</style></link>。",
    		descriptionRaw: "我方每回合首次打出友軍單位時，亂擲2張牌並召喚1個小樹精。",
    		levelupDescription: "我方單位陣亡<br>或卡牌遭<link=vocab.Toss><style=Vocab>亂擲</style></link>共計25次<style=Variable></style>。",
    		levelupDescriptionRaw: "我方單位陣亡或卡牌遭亂擲共計25次。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI008T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI008T3-full.png"
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02SI008T3",
    			"02SI008T2",
    			"02SI008"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI008T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI008T1-full.png"
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
    		collectible: false,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI008T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI008T2-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 4,
    		health: 5,
    		description: "此牌升級時，<link=keyword.Obliterate><style=Keyword>泯滅</style></link>敵方牌組，<br>只留下4張非英雄卡牌。\r\n<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：召喚1個<link=card.summon><style=AssociatedCard>小樹精</style></link>。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI007-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 1,
    		cost: 2,
    		health: 4,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：<br><link=vocab.Toss><style=Vocab>亂擲</style></link>2張牌<br>並治癒我方主堡2點生命。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI003-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 6,
    		cost: 8,
    		health: 5,
    		description: "使我方海怪單位擁有<link=keyword.Fearsome><sprite name=Fearsome><style=Keyword>威嚇</style></link>。\r\n<link=vocab.Attack><style=Vocab>攻擊</style></link>：本回合給予場上所有敵軍單位-2|-0。\r\n<style=Variable></style>",
    		descriptionRaw: "使我方海怪單位擁有威嚇。\r\n攻擊：本回合給予場上所有敵軍單位-2|-0。\r\n",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "他們察覺到危機時，為時已晚。巨大的怪物張開血盆大口，朝他們猛然攻擊；想要捕獲怪物的獵人，只能看著無盡的利齒逐漸粉碎他們的船隻，<br>等待死亡臨頭。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI001-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 5,
    		health: 4,
    		description: "另1個友軍單位陣亡時，<br>從敵方主堡<link=keyword.Drain><style=Keyword>汲取</style></link>1點生命值。",
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
    		collectible: true,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI002-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 5,
    		cost: 7,
    		health: 3,
    		description: "召喚1個侍從單位時，<br>擊殺它來召喚1個<br><link=card.summon><style=AssociatedCard>巨型食人蔓藤</style></link>。",
    		descriptionRaw: "召喚1個侍從單位時，擊殺它來召喚1個巨型食人蔓藤。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「今天……又有驚人的……四處冒出來……孩子們都非常害怕。不過……並不威脅。整天靠過來……真是不怕人的傢伙。得為牠們收集多一點莓果！」\n——拼湊起來的無名日記",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02SI008T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI004-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 3,
    		health: 1,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<br>擊殺1個友軍單位<br>來召喚2個<link=card.create><style=AssociatedCard>小樹精</style></link>。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI006-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "友軍單位首次陣亡時，<br>賦予此牌+2|+2。",
    		descriptionRaw: "友軍單位首次陣亡時，賦予此牌+2|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "闇影島的生物早就捨棄情感；他們都得<br>吃點什麼才行。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02SI008T3"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02SI009-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "於下次<link=vocab.RoundStart><style=Vocab>回合開始</style></link>召喚1個<link=card.summon><style=AssociatedCard>小樹精</style></link>。",
    		descriptionRaw: "於下次回合開始召喚1個小樹精。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO008T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO008-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "本回合給予<br>1個友軍單位<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。\r\n在手牌生成1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.secondSpell><style=AssociatedCard>震驚百里</style></link>。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO008T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO008T1-full.png"
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO005"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO005T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO005T1-full.png"
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
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO002T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO002-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 3,
    		health: 2,
    		description: "召喚此牌時，<br>在手牌生成1張<link=card.create><style=AssociatedCard>龍之庇護</style></link>。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO002T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO002T1-full.png"
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO008T1",
    			"02IO011",
    			"02IO006T3",
    			"02IO006T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO006-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 5,
    		health: 5,
    		description: "我方施放法術時，<br>本回合給予此牌<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>；\r\n再次施放法術時，<br>則額外於本回合給予其<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。",
    		descriptionRaw: "我方施放法術時，本回合給予此牌挑戰者；\r\n再次施放法術時，則額外於本回合給予其光盾。",
    		levelupDescription: "我方施放8次或以上法術<style=Variable></style>。",
    		levelupDescriptionRaw: "我方施放8次或以上法術。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO006T1",
    			"02IO006",
    			"02IO008T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO011-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "本回合給予\r\n1個友軍<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。\r\n在手牌生成1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.secondSpell><style=AssociatedCard>震驚百里</style></link>。\r\n將1張<link=card.level1><style=AssociatedCard>李星</style></link>洗入我方牌組。",
    		descriptionRaw: "本回合給予\r\n1個友軍挑戰者。\r\n在手牌生成1張飛逝震驚百里。\r\n將1張李星洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「克己復禮……」——李星",
    		artistName: "Kudos Productions",
    		name: "李星 虎嘯龍吟",
    		cardCode: "02IO011",
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
    		supertype: "英雄",
    		type: "法術",
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO008T1",
    			"02IO011",
    			"02IO006T3",
    			"02IO006"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO006T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO006T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 5,
    		health: 6,
    		description: "我方施放法術時，<br>本回合給予此牌<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>；\r\n再次施放法術時，<br>則額外於本回合給予其<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。<br>此牌<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰</style></link>敵軍單位時，<br>對其施放<link=card.attackSpell><style=AssociatedCard>神龍擺尾</style></link>。",
    		descriptionRaw: "我方施放法術時，本回合給予此牌挑戰者；\r\n再次施放法術時，則額外於本回合給予其光盾。此牌挑戰敵軍單位時，對其施放神龍擺尾。",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO006T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO006T3-full.png"
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
    		flavorText: "「必須釋放巨龍，不然牠會從內心吞噬我。」<br>——李星",
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
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO004-full.png"
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO003T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO003-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 2,
    		health: 3,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：<br>若上回合施放2次或以上法術，<br>則召喚1個<link=card.summon><style=AssociatedCard>幼龍</style></link><style=Variable></style>。",
    		descriptionRaw: "回合開始：若上回合施放2次或以上法術，則召喚1個幼龍。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「學徒必須思想清晰，因為巨龍的牽引讓太陽劃過天際，照亮我們的世界。」\n——龍道所傳教義",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO001-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "本回合打出2次法術牌<br>就能從手牌中召喚此牌。",
    		descriptionRaw: "本回合打出2次法術牌就能從手牌中召喚此牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「學徒必須專心聆聽，因為巨龍發出了原初之咆哮，將魔力賜給我們未臻成熟的心靈。」<br>——龍道所傳教義",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO003T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO003T1-full.png"
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
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "龍族",
    		subtypes: [
    			"龍族"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO005T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO005-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>1個敵軍單位<br>來召喚1個<link=card.cardRef><style=AssociatedCard>龍尾武術家</style></link>。",
    		descriptionRaw: "擊暈1個敵軍單位來召喚1個龍尾武術家。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我離開時無影無蹤，歸來時亦杳無聲息。」<br>——龍尾武術家",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"02IO010T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO010-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "<link=keyword.Recall><style=Keyword>召回</style></link>1個友軍單位以在手牌生成<br>1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.secondSpell><style=AssociatedCard>打道回府</style></link>。",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO007-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "使1個友軍單位將1個敵軍單位<br>踢向敵方主堡，視為對兩者進行<link=vocab.Strike><style=Vocab>打擊</style></link>。<br>若敵軍單位存活，則將其<link=keyword.Recall><style=Keyword>召回</style></link>。",
    		descriptionRaw: "使1個友軍單位將1個敵軍單位踢向敵方主堡，視為對兩者進行打擊。若敵軍單位存活，則將其召回。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「必須釋放巨龍，不然牠會從內心吞噬我。」<br>——李星",
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
    		collectible: true,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO010T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO010T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "從手牌召喚1個<br>魔耗值3點或以下的友軍單位。",
    		descriptionRaw: "從手牌召喚1個魔耗值3點或以下的友軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "……並以驚人的速度重整旗鼓。倖存者集結軍勢、擁立軍帥，並讓侵略者一嘗最初淨土的頑強精神。",
    		artistName: "Kudos Productions",
    		name: "打道回府",
    		cardCode: "02IO010T1",
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
    		collectible: false,
    		set: "Set2"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set2/zh_tw/img/cards/02IO009-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "若上回合我方已施放<br>2次或以上法術，<br>則此牌魔耗值-2。\r\n抽2張其他法術牌。\r\n",
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
    		collectible: true,
    		set: "Set2"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO012-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予1個友軍單位<br>+3|+0或+0|+3。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO012T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO012T2-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO012T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO012T1-full.png"
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO015.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO015-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 4,
    		health: 4,
    		description: "我方<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>或<link=keyword.Recall><style=Keyword>召回</style></link>1個敵軍單位時，<br>此牌對該單位造成2點傷害。",
    		descriptionRaw: "我方擊暈或召回1個敵軍單位時，此牌對該單位造成2點傷害。",
    		levelupDescription: "我方<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>或<link=keyword.Recall><style=Keyword>召回</style></link><br>5個或以上單位<style=Variable></style>。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO015T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO015T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 5,
    		cost: 4,
    		health: 5,
    		description: "我方<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>或<link=keyword.Recall><style=Keyword>召回</style></link>1個敵軍單位時，<br>此牌會打擊該牌。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO015T1",
    			"01IO015"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO015T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO015T2-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
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
    		supertype: "英雄",
    		type: "法術",
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO020-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "召喚此牌時，<br>本回合給予其他友軍單位+1|+0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO045.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO045-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：<br>本回合給予受此牌支援的友軍單位<link=keyword.Lifesteal><sprite name=Lifesteal><style=Keyword>吸血</style></link>。",
    		descriptionRaw: "支援：本回合給予受此牌支援的友軍單位吸血。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO008-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 2,
    		health: 3,
    		description: "每當我方<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>或<link=keyword.Recall><style=Keyword>召回</style></link>單位，<br>賦予此牌+2|+0。",
    		descriptionRaw: "每當我方擊暈或召回單位，賦予此牌+2|+0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO040.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO040-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO041T2",
    			"01IO041T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO041.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO041-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 6,
    		health: 3,
    		description: "<link=vocab.RoundEnd><style=Vocab>回合結束</style></link>：<br>在手牌生成1張來自我方牌組區域的法術牌。",
    		descriptionRaw: "回合結束：在手牌生成1張來自我方牌組區域的法術牌。",
    		levelupDescription: "我方進入<link=keyword.Enlightened><style=Keyword>開悟</style></link>狀態。",
    		levelupDescriptionRaw: "我方進入開悟狀態。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO041T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO041T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 5,
    		cost: 6,
    		health: 4,
    		description: "我方打出法術時，<br>可對相同目標再次施放。",
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO041T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO041T2-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "在手牌生成1張<br>來自我方牌組區域的法術牌。\r\n<link=keyword.Enlightened><style=Keyword>開悟</style></link>：改為生成2張。\r\n將1張<link=card.level1><style=AssociatedCard>卡瑪</style></link>洗入我方牌組。",
    		descriptionRaw: "在手牌生成1張來自我方牌組區域的法術牌。\r\n開悟：改為生成2張。\r\n將1張卡瑪洗入我方牌組。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO011-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO009T3",
    			"01IO009T2",
    			"01IO009T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO009-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：召喚1個攻擊中的<link=card.summon><style=AssociatedCard>疾風殘影</style></link>，<br>其能力值與此牌相同。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO009T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO009T2-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 3,
    		health: 3,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：<br>召喚1個攻擊中的<link=card.summon><style=AssociatedCard>疾風殘影</style></link>，<br>其能力值和特性與此牌相同。",
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO009T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO009T3-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "<link=keyword.Recall><style=Keyword>召回</style></link>1個友軍單位，<br>召喚1個<link=card.create><style=AssociatedCard>疾風殘影</style></link>取而代之。<br>將1張<link=card.level1><style=AssociatedCard>劫</style></link>洗入我方牌組。",
    		descriptionRaw: "召回1個友軍單位，召喚1個疾風殘影取而代之。將1張劫洗入我方牌組。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO009T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO009T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO014-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 3,
    		health: 1,
    		description: "召喚此牌時，賦予手牌中所有友軍單位+1|+1。",
    		descriptionRaw: "召喚此牌時，賦予手牌中所有友軍單位+1|+1。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO005-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO044.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO044-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO023.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO023-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 5,
    		health: 4,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<br>賦予手牌中1個友軍單位+3|+3。",
    		descriptionRaw: "出牌：賦予手牌中1個友軍單位+3|+3。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「每次有衝突發生，村民們總會向秋谷的遠古守護者祈求。凡能打動她心之人，皆能受到祝福，扭轉戰鬥局勢。」\n——《最初淨土傳說》",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO029.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO029-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO003-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "將1個友軍單位的<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link><br>轉移至1個敵軍單位身上。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO047.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO047-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "賦予所有戰鬥中侍從單位<br><link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO026.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO026-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<br>賦予手牌中1個友軍單位+1|+0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO024.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO024-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "選擇1個友軍單位，<br>召喚2個與之相同的複製單位，<br>其皆為<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO028.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO028-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO057.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO057-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO028T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO028T2-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO028T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO028T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO032T2",
    			"01IO032T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO032.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO032-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 4,
    		health: 5,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：<br>本回合給予受此牌支援的友軍單位<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。",
    		descriptionRaw: "支援：本回合給予受此牌支援的友軍單位光盾。",
    		levelupDescription: "此牌在場上時，<br>友軍單位獲得<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link><br>4次或以上<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌在場上時，友軍單位獲得光盾4次或以上。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO032",
    			"01IO032T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO032T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO032T1-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 4,
    		health: 6,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：<br>本回合給予受此牌支援的友軍單位<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。<br>\r\n有友軍單位獲得<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>時，<br>本回合給予該單位+3|+0。",
    		descriptionRaw: "支援：本回合給予受此牌支援的友軍單位光盾。\r\n有友軍單位獲得光盾時，本回合給予該單位+3|+0。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO032T1",
    			"01IO032"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO032T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO032T2-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "調換2個友軍單位位置，<br>並在本回合給予其<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。<br>將1張<link=card.level1><style=AssociatedCard>慎</style></link>洗入我方牌組。",
    		descriptionRaw: "調換2個友軍單位位置，並在本回合給予其光盾。將1張慎洗入我方牌組。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO013.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO013-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO018-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "本回合給予1個友軍單位<br>+1|+0與<link=keyword.Quick Strike><sprite name=QuickStrike><style=Keyword>快速攻擊</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO056T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO056.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO056-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO056T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO056T1-full.png"
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
    		flavorText: "「讓開。我是為了放逐浪人而來。」<br>——追風者．犽凝",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO016-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 6,
    		health: 4,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：選1張<link=card.me><style=AssociatedCard>西風聖者</style></link>以外的手牌，並在手牌生成1張該牌的複製牌。",
    		descriptionRaw: "出牌：選1張西風聖者以外的手牌，並在手牌生成1張該牌的複製牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「長老安慰戰敗的悲泣戰士：『去尋找諸天之上的聖者吧。唯有他能尋回仍留在記憶中的失物』。」\n——《最初淨土傳說》",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO036.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO036-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 2,
    		health: 1,
    		description: "<link=vocab.Strike><style=Vocab>打擊</style></link>：<br>使手牌中魔耗值最高的單位<br>魔耗值-1。",
    		descriptionRaw: "打擊：使手牌中魔耗值最高的單位魔耗值-1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「巡邏兵，有一……不對……兩隻巨型毛茸生物朝著我們過來了！呼叫支——喔，等等，<br>望遠鏡又拿反了……」",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO033T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO033.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO033-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 7,
    		cost: 9,
    		health: 6,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：<link=keyword.Recall><style=Keyword>召回</style></link>3個敵軍單位。",
    		descriptionRaw: "出牌：召回3個敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們當時正在草地上疾行，這個小鬼忽然不知道從哪裡跳出來，砰、砰、砰地踢到我們呼吸困難！」——那歐竊匪",
    		artistName: "SIXMOREVODKA",
    		name: "迅腿米娜",
    		cardCode: "01IO033",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO001-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "治癒1個友軍單位<br>或我方主堡7點生命。<br>抽1張牌。",
    		descriptionRaw: "治癒1個友軍單位或我方主堡7點生命。抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「唯有提高心靈層次，肉身才能變得完整。」<br>——卡瑪",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO010-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "調換2個友軍單位位置，<br>並在本回合給予其<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO022-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "本回合給予1個友軍單位<br><link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO021.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO021-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 4,
    		cost: 7,
    		health: 2,
    		description: "召喚此牌時，<br>本回合給予其他友軍單位+2|+2。",
    		descriptionRaw: "召喚此牌時，本回合給予其他友軍單位+2|+2。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「春天的花朵首先在愛歐尼亞的峭壁綻開，新生的飛禽拍打著翅膀，沐浴在春季的輕柔微風中。」\n——《最初淨土傳說》",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO054.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO054-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "在手牌生成1張來自我方牌組區域的法術牌。\r\n<link=keyword.Enlightened><style=Keyword>開悟</style></link>：改為生成2張。",
    		descriptionRaw: "在手牌生成1張來自我方牌組區域的法術牌。\r\n開悟：改為生成2張。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO027.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO027-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 2,
    		health: 1,
    		description: "<link=vocab.NexusStrike><style=Vocab>打擊主堡</style></link>：<br>在手牌生成1張此牌的複製牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO031.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO031-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO002-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 5,
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO033T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO033T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO017-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "召喚此牌時，<br>本回合給予此牌<link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO042.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO042-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "召喚1個友軍單位時，<br>本回合給予此牌+1|+1。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO006-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 2,
    		health: 1,
    		description: "每召喚1個友軍單位，<br>本回合給予此牌+1|+0。",
    		descriptionRaw: "每召喚1個友軍單位，本回合給予此牌+1|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「嘿，注意那些樹枝！左邊，小心左邊！」\n「毛球，哪一天換我坐在你肩上，去哪裡都聽你的。但在那之前，就交給我吧！」",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO050.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO050-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Allegiance><style=Vocab>效忠</style></link>：<br>從牌組召喚2個魔耗值1的<br>友軍單位。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO048.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO048-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO013"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO007-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Strike><style=Vocab>打擊</style></link>：在手牌生成1張<link=card.summon><style=AssociatedCard>暗影之魔</style></link>。",
    		descriptionRaw: "打擊：在手牌生成1張暗影之魔。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「儘量逃跑、奮戰、畏縮吧。那都不重要，暗影已來到你身旁。」",
    		artistName: "SIXMOREVODKA",
    		name: "暗影之刃．忍",
    		cardCode: "01IO007",
    		keywords: [
    			"快速攻擊"
    		],
    		keywordRefs: [
    			"QuickStrike"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO053.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO053-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO004-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "治癒1個友軍單位<br>或我方主堡3點生命。",
    		descriptionRaw: "治癒1個友軍單位或我方主堡3點生命。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO049.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO049-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "抵銷1個<link=keyword.Fast><sprite name=Fast><style=Keyword>快速</style></link>法術、<br><link=keyword.Slow><sprite name=Slow><style=Keyword>慢速</style></link>法術或<link=keyword.Skill><sprite name=PlaySkillMark><style=Keyword>技能</style></link>。",
    		descriptionRaw: "抵銷1個快速法術、慢速法術或技能。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO052T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO052.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO052-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，<br>召喚1個與此牌能力值相同的<br><link=card.summon><style=AssociatedCard>那歐竊匪</style></link>。",
    		descriptionRaw: "召喚此牌時，召喚1個與此牌能力值相同的那歐竊匪。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「諾克薩斯入侵之前，我曾是名四處旅行的音樂家，名聲從每個村莊遠播至平典城。如今我只能靠搶來的金幣苟延殘喘。母親說得對，我應該當一名<br>治療師的……」",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO052T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO052T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO030.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO030-full.png"
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
    		subtype: "龍族",
    		subtypes: [
    			"龍族"
    		],
    		supertype: "",
    		type: "單位",
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO019-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 1,
    		cost: 1,
    		health: 2,
    		description: "有友軍單位獲得<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>時，<br>賦予此牌+2|+0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO046.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO046-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>1個攻擊中敵軍單位。",
    		descriptionRaw: "擊暈1個攻擊中敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「尖銳一擊！」——犽宿",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO037.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO037-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "本回合給予1個友軍單位<br><link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>與<link=keyword.Lifesteal><sprite name=Lifesteal><style=Keyword>吸血</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO043.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO043-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 2,
    		cost: 3,
    		health: 2,
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO038.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO038-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "召喚此牌時，<br><link=keyword.Recall><style=Keyword>召回</style></link>所有其他友軍單位。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01IO009T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO039.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO039-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "<link=keyword.Recall><style=Keyword>召回</style></link>1個友軍單位，<br>召喚1個<link=card.create><style=AssociatedCard>疾風殘影</style></link>取而代之。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO055.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01IO055-full.png"
    			}
    		],
    		region: "愛歐尼亞",
    		regionRef: "Ionia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "賦予手牌中1個友軍單位<br><link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。\r\n抽1張牌。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX020-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>或<link=vocab.Strike><style=Vocab>打擊</style></link>：<br>在手牌生成1張<link=card.create><style=AssociatedCard>迴旋飛斧</style></link>。",
    		descriptionRaw: "出牌或打擊：在手牌生成1張迴旋飛斧。",
    		levelupDescription: "此牌使用<link=card.create><style=AssociatedCard>迴旋飛斧</style></link><link=vocab.Strike><style=Vocab>打擊</style></link>2次<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌使用迴旋飛斧打擊2次。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX020T2",
    			"01NX020",
    			"01NX020T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX020T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX020T3-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 4,
    		cost: 3,
    		health: 4,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>或<link=vocab.Strike><style=Vocab>打擊</style></link>：在手牌生成2張<br><link=card.create><style=AssociatedCard>迴旋飛斧</style></link>。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX020T3",
    			"01NX020"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX020T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX020T2-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "使1個戰鬥中友軍單位<br><link=vocab.Strike><style=Vocab>打擊</style></link>1個戰鬥中敵軍單位。<br>將1張<link=card.level1><style=AssociatedCard>達瑞文</style></link>洗入我方牌組。",
    		descriptionRaw: "使1個戰鬥中友軍單位打擊1個戰鬥中敵軍單位。將1張達瑞文洗入我方牌組。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX020"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX020T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX020T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX006T3",
    			"01NX006T2",
    			"01NX006T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX006-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 5,
    		cost: 5,
    		health: 5,
    		description: "<link=keyword.AttackSkillMark><sprite name=AttackSkillMark><style=Keyword>攻擊</style></link>：對此牌右邊的每個攻擊中友軍單位造成1點傷害，且每傷害1個攻擊中友軍單位，便對敵方主堡造成1點傷害。",
    		descriptionRaw: "攻擊：對此牌右邊的每個攻擊中友軍單位造成1點傷害，且每傷害1個攻擊中友軍單位，便對敵方主堡造成1點傷害。",
    		levelupDescription: "5個或以上友軍單位承受傷害且未陣亡<style=Variable></style>。",
    		levelupDescriptionRaw: "5個或以上友軍單位承受傷害且未陣亡。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX006"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX006T4.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX006T4-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對<link=card.vlad><style=AssociatedCard>弗拉迪米爾</style></link>右邊的每個攻擊中友軍單位造成1點傷害，且每傷害1個攻擊中友軍單位，便從敵方主堡<link=keyword.Drain><style=Keyword>汲取</style></link>1點生命。",
    		descriptionRaw: "對弗拉迪米爾右邊的每個攻擊中友軍單位造成1點傷害，且每傷害1個攻擊中友軍單位，便從敵方主堡汲取1點生命。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「十足美味。」——弗拉迪米爾",
    		artistName: "Max Grecke",
    		name: "血色契約",
    		cardCode: "01NX006T4",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX006"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX006T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX006T2-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對<link=card.vlad><style=AssociatedCard>弗拉迪米爾</style></link>右邊每個攻擊中友軍單位造成1點傷害，且每傷害1個攻擊中友軍單位，便對敵方主堡造成1點傷害。",
    		descriptionRaw: "對弗拉迪米爾右邊每個攻擊中友軍單位造成1點傷害，且每傷害1個攻擊中友軍單位，便對敵方主堡造成1點傷害。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX006T3",
    			"01NX006T4",
    			"01NX006"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX006T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX006T1-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 6,
    		cost: 5,
    		health: 6,
    		description: "<link=keyword.AttackSkillMark><sprite name=AttackSkillMark><style=Keyword>攻擊</style></link>：對此牌右邊的每個攻擊中友軍單位造成1點傷害，且每傷害1個攻擊中友軍單位，便從敵方主堡<link=keyword.Drain><style=Keyword>汲取</style></link>1點生命。",
    		descriptionRaw: "攻擊：對此牌右邊的每個攻擊中友軍單位造成1點傷害，且每傷害1個攻擊中友軍單位，便從敵方主堡汲取1點生命。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「親愛的，這餘興節目無法滿足你了嗎？不妨讓我向妳展示真正的盛大演出吧。」",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX006T1",
    			"01NX006"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX006T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX006T3-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "對1個友軍單位造成1點傷害，<br>本回合給予另1個友軍單位+2|+2。\r\n將1張<link=card.level1><style=AssociatedCard>弗拉迪米爾</style></link>洗入我方牌組。",
    		descriptionRaw: "對1個友軍單位造成1點傷害，本回合給予另1個友軍單位+2|+2。\r\n將1張弗拉迪米爾洗入我方牌組。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX004-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "擊殺1個力量值3點或以下<br>的單位。",
    		descriptionRaw: "擊殺1個力量值3點或以下的單位。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX032",
    			"01NX048",
    			"01NX005",
    			"01NX030"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX048.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX048-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "此牌承受傷害且未陣亡時，<br>在手牌隨機生成1張血色單位。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX038.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX038-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 6,
    		cost: 6,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "此牌在場上時<br>敵方主堡生命值為10點或以下。",
    		levelupDescriptionRaw: "此牌在場上時敵方主堡生命值為10點或以下。",
    		flavorText: "「鋼鐵般的意志，媲美泰坦巨人的力量。特菲利安軍團沒有更優秀的將軍人選了。」——斯溫\n",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX023.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX023-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 5,
    		cost: 5,
    		health: 3,
    		description: "召喚此牌時，<br>賦予我方其他蜘蛛單位+2|+0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX013.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX013-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>1個敵軍單位。<br>本回合給予所有友軍單位+2|+0。",
    		descriptionRaw: "擊暈1個敵軍單位。本回合給予所有友軍單位+2|+0。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「隨便一名蠢蛋都能以壓倒性兵力戰勝敵軍。惟有遠見的人才懂得隱藏實力，留待關鍵時刻出擊。」——斯溫",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX046T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX046.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX046-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX046T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX046T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX047.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX047-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "對1個友軍單位造成1點傷害後，<br>本回合給予另1個友軍單位+2|+2。",
    		descriptionRaw: "對1個友軍單位造成1點傷害後，本回合給予另1個友軍單位+2|+2。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX040T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX040.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX040-full.png"
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
    		flavorText: "「破盾兵可以把敵人砍成兩半。但倘若需要更加細膩的手段，軍團也不乏其他人才。」——斯溫",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX038T1",
    			"01NX038"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX038T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX038T2-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 10,
    		cost: 6,
    		health: 6,
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX038T2",
    			"01NX038"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX038T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX038T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX025.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX025-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX055.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX055-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX030.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX030-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "此牌承受傷害且未陣亡時，<br>對敵方主堡造成1點傷害。",
    		descriptionRaw: "此牌承受傷害且未陣亡時，對敵方主堡造成1點傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX007-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：<br>本回合給予其他戰鬥中友軍單位<br>+1|+0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX021.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX021-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX009-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 4,
    		health: 1,
    		description: "召喚此牌時，<br>我方場上每有1個友軍單位，<br>則賦予此牌+1|+1。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX011-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "使1個戰鬥中友軍單位<br><link=vocab.Strike><style=Vocab>打擊</style></link>1個戰鬥中敵軍單位。",
    		descriptionRaw: "使1個戰鬥中友軍單位打擊1個戰鬥中敵軍單位。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX053.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX053-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "若我方場上有1個<br>力量值5點或以上的友軍單位，<br>則擊殺所有力量值4點或以下的單位。",
    		descriptionRaw: "若我方場上有1個力量值5點或以上的友軍單位，則擊殺所有力量值4點或以下的單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「誰準備好上場廝殺啦？！！！」——競技場主持人",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX040T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX040T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX054.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX054-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>所有<br>力量值4點或以下的敵軍單位。",
    		descriptionRaw: "擊暈所有力量值4點或以下的敵軍單位。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX029.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX029-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 4,
    		cost: 4,
    		health: 5,
    		description: "每當其他友軍單位<br>承受傷害且未陣亡時，<br>賦予該單位+1|+0。",
    		descriptionRaw: "每當其他友軍單位承受傷害且未陣亡時，賦予該單位+1|+0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX014-full.png"
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX042.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX042-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<br>在手牌生成1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.create><style=AssociatedCard>利刃刀鋒</style></link>。",
    		descriptionRaw: "出牌：在手牌生成1張飛逝利刃刀鋒。",
    		levelupDescription: "此牌<link=vocab.Strike><style=Vocab>打擊</style></link>1次。<br>此牌升級時會被<link=keyword.Recall><style=Keyword>召回</style></link>。",
    		levelupDescriptionRaw: "此牌打擊1次。此牌升級時會被召回。",
    		flavorText: "「要練手感，沒有什麼比蒂瑪西亞活標靶<br>還來得適合......」",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX042T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX042T2-full.png"
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX042T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX042T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX051.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX051-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 8,
    		cost: 8,
    		health: 8,
    		description: "召喚此牌時，<br>在手牌生成3張<link=card.create><style=AssociatedCard>毀滅風暴</style></link>。",
    		descriptionRaw: "召喚此牌時，在手牌生成3張毀滅風暴。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX012-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 1,
    		health: 1,
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX043.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX043-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "對任1目標造成1點傷害。",
    		descriptionRaw: "對任1目標造成1點傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX037.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX037-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：對敵方主堡造成1點傷害。",
    		descriptionRaw: "遺願：對敵方主堡造成1點傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX010-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 4,
    		cost: 5,
    		health: 4,
    		description: "召喚此牌時，<br>本牌局我方每<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link>或<link=keyword.Recall><style=Keyword>召回</style></link>1個單<br>位，則賦予此牌+1|+1。<style=Variable></style>",
    		descriptionRaw: "召喚此牌時，本牌局我方每擊暈或召回1個單位，則賦予此牌+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "所有諾克薩斯人都知曉帝國強盛的三大法則，但是假如士兵想尋求晉升機會，他們必須學會活用三大<br>法則。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX017-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：<br>本回合給予受此牌支援的友軍單位<br><link=keyword.Quick Strike><sprite name=QuickStrike><style=Keyword>快速攻擊</style></link>。",
    		descriptionRaw: "支援：本回合給予受此牌支援的友軍單位快速攻擊。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX003-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "<br><link=vocab.RoundStart><style=Vocab>回合開始：<br></style></link>棄置我方手牌魔耗值最低的牌，<br>並抽1張牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX039.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX039-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX041.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX041-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX036.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX036-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 6,
    		cost: 6,
    		health: 6,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：<link=keyword.Stun><sprite name=Stunned><style=Keyword>擊暈</style></link><link=keyword.Weakest><style=Keyword>最弱</style></link>敵軍單位。",
    		descriptionRaw: "回合開始：擊暈最弱敵軍單位。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX044.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX044-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX005-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX016-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，<br>若場上有另1個諾克薩斯友軍單位，<br>則賦予此牌+2|+0。",
    		descriptionRaw: "召喚此牌時，若場上有另1個諾克薩斯友軍單位，則賦予此牌+2|+0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX019-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予1個友軍單位+3|+0<br>與<link=keyword.Overwhelm><sprite name=Overwhelm><style=Keyword>勢不可擋</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX015.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX015-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX050.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX050-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX056.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX056-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "對1個敵軍單位造成2點傷害，<br>然後進行<link=vocab.Rally><style=Vocab>備戰</style></link>。",
    		descriptionRaw: "對1個敵軍單位造成2點傷害，然後進行備戰。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX033.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX033-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 4,
    		cost: 5,
    		health: 3,
    		description: "召喚此牌時，我方場上每有1個<br>力量值5點或以上的友軍單位，<br>則抽1張牌。",
    		descriptionRaw: "召喚此牌時，我方場上每有1個力量值5點或以上的友軍單位，則抽1張牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX052.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX052-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "對1個友軍侍從單位造成1點傷害。<br>若其存活，<br>則在手牌生成1張該單位的複製牌。",
    		descriptionRaw: "對1個友軍侍從單位造成1點傷害。若其存活，則在手牌生成1張該單位的複製牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX045.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX045-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX031.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX031-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX002-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX008-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 4,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Allegiance><style=Vocab>效忠</style></link>：<br>賦予此牌+1|+1及<link=keyword.Overwhelm><sprite name=Overwhelm><style=Keyword>勢不可擋</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX034.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX034-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01NX020"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX035.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX035-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX026.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX026-full.png"
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
    		flavorText: "「魯莽是個缺陷，但是經歷過軍團的鍛鍊，魯莽也可以是傷人的利器。」——斯溫",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX027.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX027-full.png"
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
    		flavorText: "「張手遭拒，握拳迎擊。」\n——諾克薩斯格言",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX022-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "擊殺1個負傷單位，<br>然後在手牌生成1張<br><link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.me><style=AssociatedCard>諾克薩斯斷頭台</style></link>。",
    		descriptionRaw: "擊殺1個負傷單位，然後在手牌生成1張飛逝諾克薩斯斷頭台。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX032.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX032-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 5,
    		cost: 4,
    		health: 5,
    		description: "召喚此牌時，<br>對其他友軍單位造成1點傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX024.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX024-full.png"
    			}
    		],
    		region: "諾克薩斯",
    		regionRef: "Noxus",
    		attack: 5,
    		cost: 5,
    		health: 4,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：<br>本回合給予受此牌支援的友軍單位<br>+3|+0與<link=keyword.Overwhelm><sprite name=Overwhelm><style=Keyword>勢不可擋</style></link>。",
    		descriptionRaw: "支援：本回合給予受此牌支援的友軍單位+3|+0與勢不可擋。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX049.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01NX049-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE031.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE031-full.png"
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE022-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "此牌在場上時，<br>有4個或以上友軍單位陣亡，<br>或<link=card.senna><style=AssociatedCard>光之哨兵姍娜</style></link>陣亡<style=Variable></style>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE019-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "使手牌中所有友軍單位<br>魔耗值-1。",
    		descriptionRaw: "使手牌中所有友軍單位魔耗值-1。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE042.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE042-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 6,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "此牌在場上時，<br>我方消耗6點或以上魔力<br>施放法術<style=Variable></style>。<br>升級時在手牌生成1張<link=card.warcry><style=AssociatedCard>終極閃光</style></link>。",
    		levelupDescriptionRaw: "此牌在場上時，我方消耗6點或以上魔力施放法術。升級時在手牌生成1張終極閃光。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE042T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE042T1-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予1個<br>友軍單位<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。\r\n將1張<link=card.level1><style=AssociatedCard>拉克絲</style></link>洗入我方牌組。",
    		descriptionRaw: "本回合給予1個友軍單位光盾。\r\n將1張拉克絲洗入我方牌組。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「當你與眾不同，全世界都會跟你作對。有人說，你的不同之處會成為弱點，其實你只會更加堅強且富有同情心。再黑暗的時刻，都有我保護你！」<br>——拉克絲",
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE042T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE042T2-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 5,
    		cost: 6,
    		health: 6,
    		description: "若我方消耗6點或以上魔力施放法術，則在手牌生成1張<link=card.warcry><style=AssociatedCard>終極閃光</style></link>。<style=Variable></style>",
    		descriptionRaw: "若我方消耗6點或以上魔力施放法術，則在手牌生成1張終極閃光。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE042T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE042T3-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對1個敵軍單位造成4點傷害。 ",
    		descriptionRaw: "對1個敵軍單位造成4點傷害。 ",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我竭盡一生把光芒醞藏起來。要是他們知道……要是我知道自己握有什麼力量，會發生什麼事？」<br>——拉克絲",
    		artistName: "Kudos Productions",
    		name: "終極閃光",
    		cardCode: "01DE042T3",
    		keywords: [
    			"勢不可擋",
    			"飛逝",
    			"慢速"
    		],
    		keywordRefs: [
    			"SpellOverwhelm",
    			"Fleeting",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE010-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 5,
    		cost: 5,
    		health: 4,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：<br>在手牌隨機生成1張菁英牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE020-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE034.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE034-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "召喚菁英單位時，<br>賦予該單位+1|+1。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE002-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 8,
    		cost: 8,
    		health: 8,
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE012-full.png"
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE012T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE012T1-full.png"
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE012T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE012T2-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE017-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "若場上僅有1個友軍單位，<br>則賦予其+3|+3。",
    		descriptionRaw: "若場上僅有1個友軍單位，則賦予其+3|+3。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE045.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE045-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "此牌擊殺2個敵軍單位<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌擊殺2個敵軍單位。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE052.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE052-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 9,
    		cost: 9,
    		health: 9,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>或<link=vocab.Attack><style=Vocab>攻擊</style></link>：<br>本回合給予所有友軍單位<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE021.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE021-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE022T1",
    			"01DE022"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE022T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE022T2-full.png"
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE022T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE022T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE025.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE025-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "使1個友軍單位<br><link=keyword.Capture><sprite name=Capture><style=Keyword>俘虜</style></link>另1個單位。",
    		descriptionRaw: "使1個友軍單位俘虜另1個單位。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE007-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE055.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE055-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 3,
    		health: 2,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<br>本回合給予1個友軍單位<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE048.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE048-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE001-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE043.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE043-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 1,
    		cost: 2,
    		health: 3,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：<br>本回合給予受此牌支援的友軍單位+1|+1。",
    		descriptionRaw: "支援：本回合給予受此牌支援的友軍單位+1|+1。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE049.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE049-full.png"
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
    		flavorText: "「這名新兵的身上似乎散發出優良士兵特有的耐力與勇氣。有朝一日，他能加入無畏先鋒嗎？不過……他個子比一般人矮小，再看看他表現如何吧。」<br>——先鋒中士",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE053.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE053-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 4,
    		health: 2,
    		description: "\r\n<link=vocab.Strike><style=Vocab>打擊</style></link>：<br>在手牌隨機生成1張<br>來自我方牌組區域的<br><link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>侍從牌。",
    		descriptionRaw: "\r\n打擊：在手牌隨機生成1張來自我方牌組區域的挑戰者侍從牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE033.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE033-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "本回合每有1個友軍單位陣亡，<br>則此牌魔耗值-1。<br>隨機召喚1個魔耗值5的<br>蒂瑪西亞侍從單位。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE045T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE045T1-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 3,
    		health: 4,
    		description: "此牌擊殺4個敵軍單位並存活，<br>我方即贏下牌局。<style=Variable></style>",
    		descriptionRaw: "此牌擊殺4個敵軍單位並存活，我方即贏下牌局。",
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE045T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE045T2-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "本回合給予1個友軍單位<br>+3|+0與<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。<br>將1張<link=card.level1><style=AssociatedCard>菲歐拉</style></link>洗入我方牌組。",
    		descriptionRaw: "本回合給予1個友軍單位+3|+0與光盾。將1張菲歐拉洗入我方牌組。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE044.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE044-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "完全治癒1個友軍單位，<br>並使其力量值與生命值加倍。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE024.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE024-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：<br>在手牌生成1張魔耗值<br>6點或以上的法術牌，<br>必不屬於蒂瑪西亞區域。",
    		descriptionRaw: "遺願：在手牌生成1張魔耗值6點或以上的法術牌，必不屬於蒂瑪西亞區域。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「雖然奧術物品擁有不可言喻的迷人風采。但這些充滿力量的物品必須交到可靠的專家手上，遠離我們善良無知的市民為上策。」\n——獵魔者手冊",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE004-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 2,
    		cost: 4,
    		health: 1,
    		description: "召喚此牌時，<br>再召喚1個與此牌相同的複製單位。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE011-full.png"
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
    		flavorText: "「他做了什麼好事？我把貴重的古拉德．皮耶平衡雙刀託付給他！他明明說只會拿去進行訓練！」<br>——羅倫特刀劍收藏家",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE016"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE047.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE047-full.png"
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
    		flavorText: "無畏先鋒的聖衣在一位又一位的兵士手中傳遞。如此一來，剛入伍的新兵才會感受到身負大任的<br>重量與驕傲。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE046.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE046-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE050.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE050-full.png"
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
    		flavorText: "「反魔法英石灰色印徽是對抗魔法的基本防護，象徵我們的責任，也提醒旁人我們的權威性。從現在起，這個印徽就是你的最高榮譽。」\n——獵魔者手冊",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE016-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE040.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE040-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE036.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE036-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE037.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE037-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "本回合給予1個友軍單位<br>+3|+0與<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE016"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE014-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 8,
    		health: 0,
    		description: "召喚2個<link=card.summon><style=AssociatedCard>無畏先鋒</style></link>，<br>並賦予我方菁英單位+1|+1。",
    		descriptionRaw: "召喚2個無畏先鋒，並賦予我方菁英單位+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們的對手深明，凡攻擊我們任何一人，就等於攻擊我們全體。」\n——無畏先鋒守則\n",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE015.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE015-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 5,
    		health: 5,
    		description: "召喚此牌時，<br>若本回合有友軍單位陣亡，<br>則賦予此牌<link=keyword.Lifesteal><sprite name=Lifesteal><style=Keyword>吸血</style></link>與<link=keyword.Tough><sprite name=Tough><style=Keyword>堅忍</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE003-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE026.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE026-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "使1個友軍單位與1個敵軍單位<br>互相<link=vocab.Strike><style=Vocab>打擊</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE032.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE032-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予1個友軍單位<br><link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。",
    		descriptionRaw: "本回合給予1個友軍單位光盾。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「當你與眾不同，全世界都會跟你作對。有人說，你的不同之處會成為弱點，其實你只會更加堅強且富有同情心。再黑暗的時刻，都有我保護你！」<br>——拉克絲",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE027.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE027-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予所有友軍單位<br><link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE035"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE006-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "召喚此牌時，<br>在手牌生成1張<link=card.create><style=AssociatedCard>蒂瑪西亞萬歲！</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE022"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE038.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE038-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 4,
    		cost: 3,
    		health: 2,
    		description: "我方<link=card.luc1><style=AssociatedCard>路西恩</style></link>首次陣亡時，<br>賦予此牌+1|+1與<link=keyword.Double Strike><sprite name=DoubleStrike><style=Keyword>雙重攻擊</style></link>。",
    		descriptionRaw: "我方路西恩首次陣亡時，賦予此牌+1|+1與雙重攻擊。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE041.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE041-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE035.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE035-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "本回合給予所有友軍單位+3|+3。",
    		descriptionRaw: "本回合給予所有友軍單位+3|+3。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「它代表了我們的家園、家人，還有披甲上陣的同袍。它也是我們的驕傲、榮譽與力量。就在今日，在我們挺身奮戰的存亡之際，讓我們大力呼喊其名：蒂瑪西亞！」——先鋒中士",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE018-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE009-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<br>本回合給予1個友軍單位<link=keyword.Barrier><sprite name=Barrier><style=Keyword>光盾</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE039.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE039-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE056.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE056-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE029.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE029-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "我方召喚其他友軍單位時，<br>賦予此牌<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>。",
    		descriptionRaw: "我方召喚其他友軍單位時，賦予此牌挑戰者。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE028.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE028-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE013.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE013-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "賦予1個友軍單位<link=keyword.Tough><sprite name=Tough><style=Keyword>堅忍</style></link>。",
    		descriptionRaw: "賦予1個友軍單位堅忍。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01DE025"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE023.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE023-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "若我方在本牌局已施放1張<br>魔耗值6點或以上的法術牌，<br>則在手牌生成1張<link=card.create><style=AssociatedCard>束縛</style></link>。",
    		descriptionRaw: "若我方在本牌局已施放1張魔耗值6點或以上的法術牌，則在手牌生成1張束縛。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE051.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE051-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 6,
    		cost: 6,
    		health: 6,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：<br>本回合給予其他戰鬥中友軍單位<br>+1|+1與<link=keyword.Fearsome><sprite name=Fearsome><style=Keyword>威嚇</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE054.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE054-full.png"
    			}
    		],
    		region: "蒂瑪西亞",
    		regionRef: "Demacia",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "召喚此牌時，<br>若本回合有友軍單位陣亡，<br>則抽1張單位牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE030.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01DE030-full.png"
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ040.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ040-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ040T1",
    			"01PZ040"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ040T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ040T3-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "棄置1張牌即可出此牌。<br>對任1目標造成3點傷害。\r\n將1張<link=card.level1><style=AssociatedCard>吉茵珂絲</style></link>洗入我方牌組。",
    		descriptionRaw: "棄置1張牌即可出此牌。對任1目標造成3點傷害。\r\n將1張吉茵珂絲洗入我方牌組。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ040T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ040T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ040T2-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "對敵方主堡造成4點傷害，<br>並對所有敵軍單位<br>造成1點傷害。",
    		descriptionRaw: "對敵方主堡造成4點傷害，並對所有敵軍單位造成1點傷害。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ040T3",
    			"01PZ040",
    			"01PZ040T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ040T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ040T1-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 5,
    		cost: 4,
    		health: 4,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：抽1張牌。<br>每回合我方首次用盡手牌時，<br>在手牌生成1張<link=card.create><style=AssociatedCard>超威能死亡火箭！</style></link>。",
    		descriptionRaw: "回合開始：抽1張牌。每回合我方首次用盡手牌時，在手牌生成1張超威能死亡火箭！。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ022",
    			"01PZ008T2",
    			"01PZ008T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ008-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "<link=vocab.NexusStrike><style=Vocab>打擊主堡</style></link>：<br>將5張<link=card.shuffle><style=AssociatedCard>劇毒膨菇</style></link>隨機植入敵方牌組。",
    		descriptionRaw: "打擊主堡：將5張劇毒膨菇隨機植入敵方牌組。",
    		levelupDescription: "把15張或以上<link=card.shuffle><style=AssociatedCard>劇毒膨菇</style></link><br>植入敵方牌組<style=Variable></style>。",
    		levelupDescriptionRaw: "把15張或以上劇毒膨菇植入敵方牌組。",
    		flavorText: "「班德爾偵察隊第154條守則：未知不足以為懼！<br>第276條守則：森林居民是我們的朋友！<br>第354條守則：毛茸茸的東西或許可以摸，<br>但絕對不能吃！第417條守則……」",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ008T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ008T2-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 1,
    		health: 2,
    		description: "<link=vocab.NexusStrike><style=Vocab>打擊主堡</style></link>：<br>使敵方牌組的<link=card.shuffle><style=AssociatedCard>劇毒膨菇</style></link>數量加倍。",
    		descriptionRaw: "打擊主堡：使敵方牌組的劇毒膨菇數量加倍。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「……記得離開爆炸範圍！」",
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ008T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ008T1-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "將5張<link=card.shuffle><style=AssociatedCard>劇毒膨菇</style></link><br>隨機植入敵方牌組。\r\n將1張<link=card.level1><style=AssociatedCard>提摩</style></link>洗入我方牌組。",
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
    		collectible: false,
    		set: "Set1"
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
    			"01PZ056T8",
    			"01PZ056T9",
    			"01PZ056T2",
    			"01PZ056T6",
    			"01PZ056T5",
    			"01PZ015"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 5,
    		health: 3,
    		description: "施放法術時，在手牌生成1張<br>相同魔耗值的<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>砲臺。<br>本回合該牌魔耗值為0。",
    		descriptionRaw: "施放法術時，在手牌生成1張相同魔耗值的飛逝砲臺。本回合該牌魔耗值為0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ013T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ013.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ013-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 6,
    		health: 3,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：<br>棄置我方所有手牌後抽3張牌，<br>並對1個敵軍單位造成3點傷害。",
    		descriptionRaw: "出牌：棄置我方所有手牌後抽3張牌，並對1個敵軍單位造成3點傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ007-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 3,
    		health: 4,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：<br>為受此牌支援的友軍單位生成<br>4張複製牌並洗入我方牌組。",
    		descriptionRaw: "支援：為受此牌支援的友軍單位生成4張複製牌並洗入我方牌組。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ056T3",
    			"01PZ056T1",
    			"01PZ056T4",
    			"01PZ056T7",
    			"01PZ056T8",
    			"01PZ056T9",
    			"01PZ056T2",
    			"01PZ056T6",
    			"01PZ056T5",
    			"01PZ015",
    			"01PZ056"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T10.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T10-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 5,
    		health: 4,
    		description: "施放法術時，在手牌生成1張<br>相同魔耗值的<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link>砲臺。<br>本回合給予該牌+1|+1<br>且魔耗值為0。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T7.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T7-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 2,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「實驗室需要一些保全措施！最近傳出消息，小杰西的工作坊被小偷洗劫了一番。哈，想闖空門的盜匪注意啦！」\n——《漢默丁格的實驗室手札》第2冊",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T9.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T9-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 4,
    		cost: 4,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「又是科學的一大進步！我的投球機終於成功與海克斯能源動力結合啦！容我為各位介紹，風暴吊球機！好，該睡了。」\n——《漢默丁格的實驗室手札》第4冊",
    		artistName: "SIXMOREVODKA",
    		name: "Mk4：風暴吊球機",
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T3-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T8.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T8-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 3,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「啊，科學的美妙氣味！砲臺成功升級了！我得說……看到這個全新機型，我連脊椎都打起寒顫了！<br>嗚呼！」\n——《漢默丁格的實驗室手札》第3冊",
    		artistName: "SIXMOREVODKA",
    		name: "Mk3：究極砲臺",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T2-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 5,
    		cost: 5,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「製造過程經歷幾次推進器和導引系統的問題後，新發明終於準備好亮相啦：推進可燃物！……得再想個更響亮的名字才行。」\n——《漢默丁格的實驗室手札》第5冊",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T5.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T5-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 7,
    		cost: 7,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我夢到一隻巨大機械獸，完全聽令行事！我一定要做出這隻機械獸。首先，進行穩定性測試，接著強化武器和護甲……」\n——《漢默丁格的實驗室手札》第7冊",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T1-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「今日，我踏上了一趟全新的科學之旅：自動機械裝置！俗話說得好，偉大之人必能成就偉大之事！你問這句話是誰說的？當然是我啊！」\n——《漢默丁格的實驗室手札》〈引言〉",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T4.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T4-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「前陣子我突然想到，我只有兩隻手，最多只能拿兩把扳手！所以我想了一個解決方案：替自己加裝更多手。啊哈！開玩笑的。答案是扳手機器人！」\n——《漢默丁格的實驗室手札》第1冊",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T6.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ056T6-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 6,
    		cost: 6,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我好像把最新成品搞丟了，連帶樓中樓也消失了。真擔心那個機器人，不過陶瓷研究實驗室曾傳出尖叫聲，看來我還有希望！」\n——《漢默丁格的實驗室手札》第6冊",
    		artistName: "SIXMOREVODKA",
    		name: "Mk6：破地螺旋鑽",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ018-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ019-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ022"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ025.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ025-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "我方施放法術時，<br>將3張<link=card.shuffle><style=AssociatedCard>劇毒膨菇</style></link><br>隨機植入敵方牌組。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ048T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ048.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ048-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 6,
    		cost: 9,
    		health: 6,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：<br><link=keyword.Obliterate><style=Keyword>泯滅</style></link>我方牌組最上方5張牌，<br>其中每張法術可對所有敵軍單位<br>及敵方主堡造成1點傷害。",
    		descriptionRaw: "出牌：泯滅我方牌組最上方5張牌，其中每張法術可對所有敵軍單位及敵方主堡造成1點傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ048T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ048T1-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "<link=keyword.Obliterate><style=Keyword>泯滅</style></link>我方牌組最上方5張牌，<br>其中每張法術可對所有敵軍單位<br>及敵方主堡造成1點傷害。",
    		descriptionRaw: "泯滅我方牌組最上方5張牌，其中每張法術可對所有敵軍單位及敵方主堡造成1點傷害。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ032.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ032-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ015.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ015-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 8,
    		cost: 8,
    		health: 8,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「終於完成了！六百五十二呎高，配備轉缸式發動機、海克斯鍍層、四鈾電池驅動的大腳巨獸！！！請容我自誇一下，這是我窮盡畢生之力的顛峰之作！」\n——《漢默丁格的實驗室手札》第8冊",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ008"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ022-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對我方主堡造成1點傷害。",
    		descriptionRaw: "對我方主堡造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「膨菇爆開，膨菇爆開，\n喔喔喔，喔喔喔！\n膨菇爆開，膨菇爆開，\n把人害，把人害！」\n——佐恩童謠",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ032"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ028.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ028-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "施放或被棄置時，<br>召喚1個<link=card.summon><style=AssociatedCard>廢料河蟹</style></link>。",
    		descriptionRaw: "施放或被棄置時，召喚1個廢料河蟹。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ050.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ050-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "本回合給予1個友軍單位+4|+0<br>與<link=keyword.Quick Strike><sprite name=QuickStrike><style=Keyword>快速攻擊</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ054T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ054.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ054-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 2,
    		health: 3,
    		description: "<link=keyword.AttackSkillMark><sprite name=AttackSkillMark><style=Keyword>攻擊</style></link>：<br>對敵方主堡造成2點傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ054T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ054T1-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ030T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ030.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ030-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 4,
    		health: 3,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：選1個侍從單位，<br>將此牌幻化為<br>與之相同的複製單位。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ030T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ030T1-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "選1個侍從單位，<br>將此牌幻化為<br>與之相同的複製單位。",
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
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ047"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ017-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "召喚此牌時，<br>召喚2個<link=card.create><style=AssociatedCard>腐蝕藥劑桶</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ038.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ038-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 4,
    		cost: 3,
    		health: 3,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：棄置1張牌以抽1張牌。",
    		descriptionRaw: "出牌：棄置1張牌以抽1張牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ036T2",
    			"01PZ036T1",
    			"01PZ052"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ036.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ036-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 3,
    		health: 3,
    		description: "<link=vocab.NexusStrike><style=Vocab>打擊主堡</style></link>：<br>在手牌生成1張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.create><style=AssociatedCard>秘術射擊</style></link>。",
    		descriptionRaw: "打擊主堡：在手牌生成1張飛逝秘術射擊。",
    		levelupDescription: "我方指定6個或以上敵軍單位<br>為法術/技能目標<style=Variable></style>。",
    		levelupDescriptionRaw: "我方指定6個或以上敵軍單位為法術/技能目標。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ036T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ036T1-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 3,
    		health: 4,
    		description: "<link=vocab.NexusStrike><style=Vocab>打擊主堡</style></link>：在手牌生成一張<link=keyword.Fleeting><sprite name=Fleeting><style=Keyword>飛逝</style></link><link=card.create><style=AssociatedCard>秘術射擊</style></link>。\r\n我方施放法術時，對敵方主堡造成1點傷害；如果施放目標為敵軍單位，則改為對敵方主堡造成2點<br>傷害。",
    		descriptionRaw: "打擊主堡：在手牌生成一張飛逝秘術射擊。\r\n我方施放法術時，對敵方主堡造成1點傷害；如果施放目標為敵軍單位，則改為對敵方主堡造成2點傷害。",
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ036T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ036T2-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "對任1目標造成2點傷害。\r\n將1張<link=card.level1><style=AssociatedCard>伊澤瑞爾</style></link>洗入我方牌組。",
    		descriptionRaw: "對任1目標造成2點傷害。\r\n將1張伊澤瑞爾洗入我方牌組。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ035.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ035-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 4,
    		cost: 6,
    		health: 4,
    		description: "此牌成為法術/技能目標且未陣亡時，抽1張牌。",
    		descriptionRaw: "此牌成為法術/技能目標且未陣亡時，抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "梅德拉達氏族在皮爾托福聲名顯赫，身為法定繼承人的杰卻對家族事業興趣缺缺，成天只想追尋古文物……父親為此苦惱不已。",
    		artistName: "SIXMOREVODKA",
    		name: "杰．梅德拉達",
    		cardCode: "01PZ035",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ022"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ010-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "將5張<link=card.shuffle><style=AssociatedCard>劇毒膨菇</style></link><br>隨機植入敵方牌組。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ045.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ045-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：棄置1張牌以抽1張牌。",
    		descriptionRaw: "出牌：棄置1張牌以抽1張牌。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「還以為汙水坑的貧民們多少會互相照顧呢。」\n「兄弟，他們光自怨自艾就沒時間了吧。」\n「真可憐。呃……你有看到我的錢包嗎？」",
    		artistName: "SIXMOREVODKA",
    		name: "佐恩小乞丐",
    		cardCode: "01PZ045",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ013T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ013T1-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "棄置我方所有手牌後抽3張牌，<br>並對1個敵軍單位造成3點傷害。",
    		descriptionRaw: "棄置我方所有手牌後抽3張牌，並對1個敵軍單位造成3點傷害。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ002-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 4,
    		health: 2,
    		description: "召喚此牌時，本牌局我方每召喚1個<link=card.me><style=AssociatedCard>陋巷酒吧老闆</style></link>，則在手牌生成1張來自我方牌組區域的卡牌。<style=Variable></style>",
    		descriptionRaw: "召喚此牌時，本牌局我方每召喚1個陋巷酒吧老闆，則在手牌生成1張來自我方牌組區域的卡牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ004-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ020-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ046.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ046-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "選1張手牌，<br>生成4張與之相同的複製牌<br>並洗入我方牌組。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ052.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ052-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "對任1目標造成2點傷害。",
    		descriptionRaw: "對任1目標造成2點傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ033T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ033.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ033-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "若我方在本牌局打出<br><style=Variable>20</style>張不同名稱的卡牌，<br>則召喚1個<link=card.summon><style=AssociatedCard>貓劫降臨</style></link>。<style=Variable></style>",
    		descriptionRaw: "若我方在本牌局打出20張不同名稱的卡牌，則召喚1個貓劫降臨。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「到頭來，為了馮奕卜的願景付出努力的所有人都被蒙在鼓裡。我們對後果一無所知，不曉得自己即將釋放多麼恐怖的力量。」——皮爾托福專案工程師",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ033T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ033T1-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ005-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "將1個侍從單位<br>幻化為場上另1個侍從單位。",
    		descriptionRaw: "將1個侍從單位幻化為場上另1個侍從單位。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ021.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ021-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 5,
    		cost: 5,
    		health: 3,
    		description: "<link=vocab.NexusStrike><style=Vocab>打擊主堡</style></link>：<br>召喚1個與此牌相同的<br>複製單位。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ031.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ031-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ059.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ059-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ001-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "棄置2張牌，接著抽2張牌。\r\n若手牌中除此牌外只剩1張牌，<br>則棄置該牌，接著抽1張牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ032"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ057.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ057-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ027.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ027-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "用盡所有魔力即可出此牌。\r\n<style=Variable>對1個單位造成<br>等同消耗魔力的傷害。</style>",
    		descriptionRaw: "用盡所有魔力即可出此牌。\r\n對1個單位造成等同消耗魔力的傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我們耗盡了時間和資金，儘管現在光束能正常運作，我們仍無法調節光束消耗的能量。」<br>——佐恩實驗家",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ055.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ055-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 1,
    		health: 2,
    		description: "我方抽牌時，<br>本回合給予此牌+1|+0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ014T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ014-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ026"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ034.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ034-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 4,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Allegiance><style=Vocab>效忠</style></link>：<br>在手牌生成1張<link=card.create><style=AssociatedCard>汙水坑地圖</style></link>。<br>本回合該牌的魔耗值為0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ014T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ014T1-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 5,
    		cost: 6,
    		health: 5,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「絕對不是正規硬體設備。」<br>——皮爾托福安全檢查局",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ033T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ060.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ060-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "若我方在本牌局打出<br><style=Variable>15</style>張不同名稱的卡牌，<br>則召喚1個<link=card.summon><style=AssociatedCard>貓劫降臨</style></link>。<style=Variable></style>",
    		descriptionRaw: "若我方在本牌局打出15張不同名稱的卡牌，則召喚1個貓劫降臨。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「到頭來，為了馮奕卜的願景付出努力的所有人都被蒙在鼓裡。我們對後果一無所知，不曉得自己即將釋放多麼恐怖的力量。」——皮爾托福專案工程師",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ003-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 3,
    		health: 1,
    		description: "施放法術時，賦予此牌+1|+1。",
    		descriptionRaw: "施放法術時，賦予此牌+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「任何笨蛋都能組裝機器，但要將真正的尖端科技灌輸到機械大腦裡，只有百年難得一見的奇才做得到！過不久那些該死的官僚就會乖乖爬回來<br>找我了……」——科拉斯．漢維克",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ044T2"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ044.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ044-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 5,
    		cost: 5,
    		health: 2,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：<br>對所有敵軍單位造成1點傷害。",
    		descriptionRaw: "出牌：對所有敵軍單位造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「……他的獨奏忽地轉成和聲小調，接著又彈奏起琶音——琶音是一種演奏技巧——一路滑進橋段的移調。你八成不懂得欣賞他的傑作吧。」<br>——看門人，麥克斯．布里夫",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ029.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ029-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：<br>在手牌生成1張來自我方牌組區域的史詩牌。",
    		descriptionRaw: "遺願：在手牌生成1張來自我方牌組區域的史詩牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ051.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ051-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 4,
    		health: 3,
    		description: "使我方所有法術/技能<br>額外造成1點傷害。",
    		descriptionRaw: "使我方所有法術/技能額外造成1點傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ044T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ044T2-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ023.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ023-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 4,
    		health: 3,
    		description: "我方召喚魔耗值1的友軍單位時，<br>賦予其+2|+2。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ024.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ024-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ049.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ049-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ006-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 6,
    		cost: 10,
    		health: 6,
    		description: "本牌局我方每施放1張法術，<br>則此牌魔耗值-1。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ053.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ053-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，<br>在手牌生成1張<link=card.create><style=AssociatedCard>蘑菇雲</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ012-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ039.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ039-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "棄置1張牌即可出此牌。\r\n對任1目標造成3點傷害。",
    		descriptionRaw: "棄置1張牌即可出此牌。\r\n對任1目標造成3點傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ016-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "在手牌生成1張魔耗值6點或以上、<br>來自我方牌組區域的法術牌。<br>恢復我方的法術魔力。",
    		descriptionRaw: "在手牌生成1張魔耗值6點或以上、來自我方牌組區域的法術牌。恢復我方的法術魔力。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01PZ022",
    			"01PZ010"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ058.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ058-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 4,
    		cost: 4,
    		health: 3,
    		description: "召喚此牌時，<br>在手牌生成2張<link=card.create><style=AssociatedCard>蘑菇雲</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ009-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ042.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ042-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 1,
    		cost: 2,
    		health: 3,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：<br>本回合給予受此牌支援的友軍單位<link=keyword.Elusive><sprite name=Elusive><style=Keyword>隱密</style></link>。",
    		descriptionRaw: "支援：本回合給予受此牌支援的友軍單位隱密。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ026.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ026-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ043.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ043-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.NexusStrike><style=Vocab>打擊主堡</style></link>：在手牌生成1張<br>來自敵方牌組的隨機法術。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ047.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01PZ047-full.png"
    			}
    		],
    		region: "皮爾托福&佐恩",
    		regionRef: "PiltoverZaun",
    		attack: 0,
    		cost: 0,
    		health: 1,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：<br>對雙方主堡各造成1點傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR024T4",
    			"01FR024T3",
    			"01FR024T2",
    			"01FR024T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR024.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR024-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 2,
    		cost: 6,
    		health: 4,
    		description: "<link=keyword.AttackSkillMark><sprite name=AttackSkillMark><style=Keyword>攻擊</style></link>：<br>對所有敵軍單位與敵方主堡<br>造成1點傷害。<br><link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：<br>復甦此牌並幻化為<link=card.transform><style=AssociatedCard>蛋妮維亞</style></link>。",
    		descriptionRaw: "攻擊：對所有敵軍單位與敵方主堡造成1點傷害。遺願：復甦此牌並幻化為蛋妮維亞。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR024T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR024T2-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對所有敵軍單位和敵方主<br>堡造成1點傷害。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR024T4",
    			"01FR024T3",
    			"01FR024"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR024T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR024T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR024T5",
    			"01FR024T1",
    			"01FR024",
    			"01FR024T4"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR024T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR024T3-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 6,
    		health: 5,
    		description: "<link=keyword.AttackSkillMark><sprite name=AttackSkillMark><style=Keyword>攻擊</style></link>：<br>對所有敵軍單位與敵方主堡<br>造成2點傷害。<br><link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：<br>復甦此牌並幻化為<link=card.transform><style=AssociatedCard>蛋妮維亞</style></link>。",
    		descriptionRaw: "攻擊：對所有敵軍單位與敵方主堡造成2點傷害。遺願：復甦此牌並幻化為蛋妮維亞。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR024T3",
    			"01FR024"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR024T5.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR024T5-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對所有敵軍單位和敵方主堡<br>造成2點傷害。",
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
    		rarity: "無",
    		rarityRef: "None",
    		subtype: "",
    		subtypes: [
    		],
    		supertype: "",
    		type: "技能",
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR024T4.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR024T4-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 1,
    		health: 1,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "<link=vocab.RoundStart><style=Vocab>回合開始：</style></link>若我方進入<link=keyword.Enlightened><style=Keyword>開悟</style></link>狀態，將此牌幻化回<link=card.level1><style=AssociatedCard>艾妮維亞</style></link>並升級。",
    		levelupDescriptionRaw: "回合開始：若我方進入開悟狀態，將此牌幻化回艾妮維亞並升級。",
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR039.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR039-full.png"
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR039T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR039T1-full.png"
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR039T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR039T2-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR006-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "挑選1個友軍單位，<br>賦予我方<link=vocab.Everywhere><style=Vocab>各處</style></link>與之相同的單位與卡牌<br>+2|+2。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR022-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "召喚此牌時，<br>賦予牌組最上方2個友軍單位+1|+1。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR042.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR042-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR053",
    			"01FR009T2",
    			"01FR009T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR009-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 4,
    		health: 5,
    		description: "此牌首次承受傷害且未陣亡時，召喚1個<link=card.create><style=AssociatedCard>大力普羅</style></link>。",
    		descriptionRaw: "此牌首次承受傷害且未陣亡時，召喚1個大力普羅。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR018-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR036T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR036.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR036-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 3,
    		health: 1,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：<br>對1個敵軍單位造成1點傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR045.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR045-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 2,
    		cost: 3,
    		health: 4,
    		description: "此牌承受傷害且未陣亡時，<br>賦予此牌+3|+0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR008.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR008-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "召喚此牌時，<br>在手牌隨機生成1張<br>魔耗值1的其他普羅牌。",
    		descriptionRaw: "召喚此牌時，在手牌隨機生成1張魔耗值1的其他普羅牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR008T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR008T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "召喚此牌時，<br>在手牌隨機生成1張<br>魔耗值1的其他普羅牌。",
    		descriptionRaw: "召喚此牌時，在手牌隨機生成1張魔耗值1的其他普羅牌。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR055.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR055-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "選1個敵軍單位，<br>若其力量值為0點，<br>則對該單位造成4點傷害。<br>若否，則<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>該單位。",
    		descriptionRaw: "選1個敵軍單位，若其力量值為0點，則對該單位造成4點傷害。若否，則凍傷該單位。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR038.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR038-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 5,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link><link=vocab.Strongest><style=Vocab>最強</style></link>的敵軍。",
    		descriptionRaw: "攻擊：凍傷最強的敵軍。",
    		levelupDescription: "我方<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>5個或以上的<br>敵軍單位<style=Variable></style>。<br>此牌升級時，在牌組最上方生成1張<link=card.create><style=AssociatedCard>水晶箭</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR038T3.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR038T3-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>1個敵軍單位，<br>接著<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>所有其他<br>生命值3點或以下的敵軍單位。<br>抽1張牌。",
    		descriptionRaw: "凍傷1個敵軍單位，接著凍傷所有其他生命值3點或以下的敵軍單位。抽1張牌。",
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR038T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR038T2-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 6,
    		cost: 4,
    		health: 4,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link><link=vocab.Strongest><style=Vocab>最強</style></link>敵軍單位。\r\n力量值0的敵軍單位無法進行格檔。",
    		descriptionRaw: "攻擊：凍傷最強敵軍單位。\r\n力量值0的敵軍單位無法進行格檔。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR038T2",
    			"01FR038"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR038T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR038T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR029.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR029-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR035.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR035-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 1,
    		health: 3,
    		description: "此牌承受傷害且未陣亡時，<br>賦予此牌+3|+0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR028.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR028-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR020-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR028"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR014-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 1,
    		cost: 1,
    		health: 2,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：<br>將2張<link=card.create><style=AssociatedCard>暴怒雪怪</style></link>洗入我方牌組。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR049T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR049.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR049-full.png"
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
    		flavorText: "「兔子就是兔子，永遠無法變成狼。」\n——冬之爪俗語",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR037.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR037-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Allegiance><style=Vocab>效忠</style></link>：<br>賦予牌組最上方的友軍單位+3|+3與<link=keyword.Overwhelm><sprite name=Overwhelm><style=Keyword>勢不可擋</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR009T2",
    			"01FR009",
    			"01FR053"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR009T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR009T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 1,
    		cost: 4,
    		health: 6,
    		description: "此牌承受傷害且未陣亡時，<br>召喚1個<link=card.create><style=AssociatedCard>大力普羅</style></link>。",
    		descriptionRaw: "此牌承受傷害且未陣亡時，召喚1個大力普羅。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「聽好了，接下來的這個故事，主角是布郎姆和他身邊最強大的普羅們！」——長者英格瓦",
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR009T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR009T2-full.png"
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
    		flavorText: "「……布郎姆的傷勢頗為嚴重，他卻仰天大笑。因為他知道最艱困危急的時刻，正是英雄誕生之際！」\n——《布郎姆傳說》",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR026.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR026-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR030.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR030-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>1個生命值3點或以下的<br>敵軍單位。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR013.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR013-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 6,
    		health: 8,
    		description: "此牌承受傷害且未陣亡時，<br>賦予此牌+3|+0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR019-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 7,
    		health: 0,
    		description: "擊殺所有力量值0的敵軍單位，<br>接著<link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>所有敵軍單位。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR041.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR041-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 5,
    		cost: 5,
    		health: 5,
    		description: "召喚此牌時，賦予牌組中所有友軍單位+1|+1。",
    		descriptionRaw: "召喚此牌時，賦予牌組中所有友軍單位+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「眾多部族為了同一面旗幟而戰！或許終有一天，弗雷爾卓德全體能齊心禦敵。」",
    		artistName: "SIXMOREVODKA",
    		name: "艾伐洛森爐衛 ",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR025.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR025-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "召喚此牌時，<br>若我方場上有普羅單位，<br>則抽1張普羅牌。",
    		descriptionRaw: "召喚此牌時，若我方場上有普羅單位，則抽1張普羅牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR054.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR054-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR021T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR021.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR021-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 5,
    		cost: 5,
    		health: 8,
    		description: "<link=keyword.AttackSkillMark><sprite name=AttackSkillMark><style=Keyword>攻擊</style></link>：<br>對所有戰鬥中單位造成1點傷害。",
    		descriptionRaw: "攻擊：對所有戰鬥中單位造成1點傷害。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「塔卡茲打起仗比多數人更奮力勇猛，遇到挫敗也能很有風度地接受。至少多數時候是這樣……」<br>——泰達米爾",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR021T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR021T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR043T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR043.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR043-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 4,
    		cost: 6,
    		health: 4,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<br>將所有我方場上的普羅<br>結合成為1個<link=card.transform><style=AssociatedCard>普羅成群</style></link>，<br>它能獲得所有的能力值與特性。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR049T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR049T1-full.png"
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
    		flavorText: "「不管是狼還是野兔，我們全都是冬天的獵物。」\n——艾伐洛森諺語",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR033.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR033-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 3,
    		health: 3,
    		description: "<link=vocab.RoundStart><style=Vocab>回合開始</style></link>：<br>本回合額外獲得1顆魔力寶石。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR011-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR050.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR050-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<br>治癒1個友軍單位或<br>我方主堡3點生命。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR052T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR052.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR052-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 10,
    		cost: 10,
    		health: 10,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：<br><link=keyword.Obliterate><style=Keyword>泯滅</style></link>手牌及場上所有<br>力量值4點或以下的侍從單位。",
    		descriptionRaw: "出牌：泯滅手牌及場上所有力量值4點或以下的侍從單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「我從碎石堆中站起身，發現周圍地上燒出一圈烙印。夥伴曾經站立的地方成了一堆悶燒的灰燼，而不遠處有個若隱若現的形體邁步向前……」<br>——漫遊者比亞",
    		artistName: "SIXMOREVODKA",
    		name: "虛厄遊獸",
    		cardCode: "01FR052",
    		keywords: [
    			"再生"
    		],
    		keywordRefs: [
    			"Regeneration"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR052T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR052T1-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "<link=keyword.Obliterate><style=Keyword>泯滅</style></link>手牌及場上所有<br>力量值4點或以下的侍從單位。",
    		descriptionRaw: "泯滅手牌及場上所有力量值4點或以下的侍從單位。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR016-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR005-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR023.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR023-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 12,
    		health: 0,
    		description: "現在及每<link=vocab.RoundStart><style=Vocab>回合開始</style></link>時，<br>召喚牌組最上方的友軍單位。",
    		descriptionRaw: "現在及每回合開始時，召喚牌組最上方的友軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "總有一天，一聲無庸置疑的呼喚將響徹弗雷爾卓德，宣告遠古仇敵再次現身。屆時所有人都會挺身回應<br>呼召。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR047.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR047-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR056.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR056-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 5,
    		cost: 7,
    		health: 5,
    		description: "召喚此牌時，<br><link=keyword.Frostbite><sprite name=Frostbite><style=Keyword>凍傷</style></link>所有生命值3點或以下的<br>敵軍單位。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR027.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR027-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR057.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR057-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR004-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR028"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR048.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR048-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 3,
    		health: 3,
    		description: "召喚此牌時，<br>將1張<link=card.create><style=AssociatedCard>暴怒雪怪</style></link><br>洗入我方牌組最上方3張牌中。",
    		descriptionRaw: "召喚此牌時，將1張暴怒雪怪洗入我方牌組最上方3張牌中。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR017.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR017-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 5,
    		health: 3,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<br>從我方牌組最上方6張牌中召喚所有厄努克，將其餘卡牌洗回我方牌組。",
    		descriptionRaw: "出牌：從我方牌組最上方6張牌中召喚所有厄努克，將其餘卡牌洗回我方牌組。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR046.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR046-full.png"
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
    		flavorText: "「……布郎姆的傷勢頗為嚴重，他卻仰天大笑。因為他知道最艱困危急的時刻，正是英雄誕生之際！」\n——《布郎姆傳說》",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR012-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "獲得1個魔力寶石槽位，<br>並治癒主堡3點生命。",
    		descriptionRaw: "獲得1個魔力寶石槽位，並治癒主堡3點生命。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR040.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR040-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR031.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR031-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 5,
    		cost: 7,
    		health: 5,
    		description: "<link=vocab.RoundEnd><style=Vocab>回合結束</style></link>：此牌魔耗值-1。",
    		descriptionRaw: "回合結束：此牌魔耗值-1。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR036T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR036T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR053.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR053-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR010-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR001-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR043"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR043T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR043T1-full.png"
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
    		flavorText: "「…‥一開始她不知道這些小東西有何能耐。後來一隻隻前仆後繼出現，直到整個大廳都被牠們塞滿！所有普羅齊聚——」\n「該睡了！你們兩個要是沒在五分鐘內睡著<br>的話——！」",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR032.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR032-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "每當我方施放法術，<br>便賦予我方牌組最上方的友軍單位<br>+1|+1。",
    		descriptionRaw: "每當我方施放法術，便賦予我方牌組最上方的友軍單位+1|+1。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01FR028"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR051.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR051-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "若我方場上有雪怪單位，<br>則召喚1個<link=card.create><style=AssociatedCard>暴怒雪怪</style></link>。<br>若無，<br>則改為生成該牌置於我方牌組最上方。",
    		descriptionRaw: "若我方場上有雪怪單位，則召喚1個暴怒雪怪。若無，則改為生成該牌置於我方牌組最上方。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR034.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR034-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 1,
    		cost: 7,
    		health: 1,
    		description: "召喚此牌時，<br>每有1個友軍單位陣亡，<br>則賦予此牌+1|+1。<style=Variable></style>",
    		descriptionRaw: "召喚此牌時，每有1個友軍單位陣亡，則賦予此牌+1|+1。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「唉，老比亞經歷了一些事情，在北方失去了手下。他幾個月後歸來，整個人臉色蒼白，語無倫次。現在只會喃喃重複『巨大野獸』、『超大利爪』。真是可憐……」——親切的小酒館老闆",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR007-full.png"
    			}
    		],
    		region: "弗雷爾卓德",
    		regionRef: "Freljord",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "召喚此牌時，<br>抽1張力量值5點或以上的單位牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01FR003-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI038.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI038-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 3,
    		health: 3,
    		description: "每有1其他友軍單位陣亡，<br>則對敵方主堡造成1點傷害。",
    		descriptionRaw: "每有1其他友軍單位陣亡，則對敵方主堡造成1點傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI049.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI049-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "擊殺1個友軍單位，<br>然後抽2張牌。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI053.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI053-full.png"
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI053T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI053T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "若本回合有友軍單位陣亡，<br>則可召喚2個<link=card.create><style=AssociatedCard>小蜘蛛</style></link>。<br>將1張<link=card.level1><style=AssociatedCard>伊莉絲</style></link>洗入我方牌組。",
    		descriptionRaw: "若本回合有友軍單位陣亡，則可召喚2個小蜘蛛。將1張伊莉絲洗入我方牌組。",
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI053T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI053T2-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 2,
    		health: 3,
    		description: "使我方其他蜘蛛單位<br>擁有<link=keyword.Challenger><sprite name=Challenger><style=Keyword>挑戰者</style></link>和<link=keyword.Fearsome><sprite name=Fearsome><style=Keyword>威嚇</style></link>。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI057.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI057-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI023.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI023-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 2,
    		health: 3,
    		description: "召喚<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>友軍單位時，<br>賦予其+1|+1。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI024"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI010.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI010-full.png"
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI042.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI042-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 5,
    		cost: 6,
    		health: 5,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：召喚2個攻擊中的<link=card.summon><style=AssociatedCard>幽魂騎士</style></link>。",
    		descriptionRaw: "攻擊：召喚2個攻擊中的幽魂騎士。",
    		levelupDescription: "我方以7個或以上<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>友軍單位攻擊<style=Variable></style>。",
    		levelupDescriptionRaw: "我方以7個或以上閃靈友軍單位攻擊。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI042T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI042T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 6,
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI042T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI042T2-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI027T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI027.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI027-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "若本回合有3個或以上<br>友軍單位陣亡，<br>則召喚<link=card.summon><style=AssociatedCard>威洛魔</style></link>。\r\n<style=Variable></style>",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI027T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI027T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI048T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI048.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI048-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI018.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI018-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 3,
    		health: 3,
    		description: "召喚此牌時，在手牌生成1張<br>本牌局陣亡友軍單位的複製牌。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI030.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI030-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 3,
    		health: 3,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "此牌在場上時，<br>有3個或以上友軍單位陣亡<style=Variable></style>。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI030T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI030T2-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 5,
    		cost: 3,
    		health: 4,
    		description: "每回合此牌首次攻擊時，<br>復甦1個<link=vocab.Strongest><style=Vocab>最強</style></link>已陣亡友軍侍從單位，<br>使其處於攻擊中並賦予<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。<br>該回合此牌與該單位締結關係，<br>此牌所受傷害轉嫁至該單位。",
    		descriptionRaw: "每回合此牌首次攻擊時，復甦1個最強已陣亡友軍侍從單位，使其處於攻擊中並賦予閃靈。該回合此牌與該單位締結關係，此牌所受傷害轉嫁至該單位。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI030T2",
    			"01SI030"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI030T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI030T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "若本回合有友軍單位陣亡，則可對1個單位造成4點傷害。\r\n將1張<link=card.level1><style=AssociatedCard>克黎思妲</style></link>洗入我方牌組。",
    		descriptionRaw: "若本回合有友軍單位陣亡，則可對1個單位造成4點傷害。\r\n將1張克黎思妲洗入我方牌組。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI035T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI035.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI035-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 7,
    		cost: 8,
    		health: 5,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：若本回合有友軍陣亡，<br>則擊殺2個<link=keyword.Weakest><style=Keyword>最弱</style></link>敵軍單位。",
    		descriptionRaw: "出牌：若本回合有友軍陣亡，則擊殺2個最弱敵軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「他們說……他們稱之為傳奇旅程。我們的任務是保衛……蒂瑪西亞的未來。我們懷抱著希望航行，但是……犧牲這麼多人……究竟為了什麼？」<br>——蒂瑪西亞士兵，阿里．倫斯",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI035T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI035T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "若本回合有友軍單位陣亡，<br>則擊殺2個<link=keyword.Weakest><style=Keyword>最弱</style></link>敵軍單位。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI002.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI002-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI024.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI024-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI005.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI005-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 5,
    		cost: 10,
    		health: 5,
    		description: "本牌局每有1個友軍單位陣亡，<br>則此牌魔耗值-1。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI037.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI037-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI048T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI048T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 2,
    		health: 3,
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI052.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI052-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 3,
    		cost: 5,
    		health: 6,
    		description: "",
    		descriptionRaw: "",
    		levelupDescription: "此牌在場上時，<br>有6個或以上單位陣亡<style=Variable></style>。",
    		levelupDescriptionRaw: "此牌在場上時，有6個或以上單位陣亡。",
    		flavorText: "「鎖鏈鏗鏘作響，有人要來把你抓走……\n鎖鏈鏗鏘作響，獄長就在你身後……」",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI033T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI033.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI033-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 9,
    		cost: 9,
    		health: 6,
    		description: "<link=keyword.PlaySkillMark><sprite name=PlaySkillMark><style=Keyword>出牌</style></link>：對敵方主堡造成<br>等同其當前一半生命值的傷害，<br>無條件進位。<br><link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：將此牌收回手牌。",
    		descriptionRaw: "出牌：對敵方主堡造成等同其當前一半生命值的傷害，無條件進位。遺願：將此牌收回手牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI003.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI003-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 9,
    		health: 0,
    		description: "復甦本牌局<link=vocab.Strongest><style=Vocab>最強</style></link>的<br>6個陣亡友軍單位，<br>賦予其<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI041.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI041-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 3,
    		health: 2,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：於下次<link=vocab.RoundStart><style=Vocab>回合開始</style></link>復甦此牌，且此牌每次陣亡，賦予其+1|+1。<style=Variable></style>",
    		descriptionRaw: "遺願：於下次回合開始復甦此牌，且此牌每次陣亡，賦予其+1|+1。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI045.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI045-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "從1個友軍單位<link=keyword.Drain><style=Keyword>汲取</style></link>4點生命。",
    		descriptionRaw: "從1個友軍單位汲取4點生命。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI036.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI036-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "若本回合有友軍單位陣亡，<br>則召喚2個<link=card.create><style=AssociatedCard>小蜘蛛</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI051.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI051-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 5,
    		health: 4,
    		description: "1個友軍單位陣亡時，<br>恢復我方的法術魔力。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI012.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI012-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 1,
    		health: 1,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<br>賦予手牌中1個友軍單位<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>，<br>且魔耗值-1。",
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
    		collectible: true,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI052T2.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI052T2-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "對本回合召喚的所有敵軍單位<br>造成3點傷害。<br>將1張<link=card.level1><style=AssociatedCard>瑟雷西</style></link>洗入我方牌組。",
    		descriptionRaw: "對本回合召喚的所有敵軍單位造成3點傷害。將1張瑟雷西洗入我方牌組。",
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
    		collectible: false,
    		set: "Set1"
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
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI052T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI052T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 5,
    		health: 7,
    		description: "此牌在本牌局首次攻擊時，<br>從我方牌組或手牌召喚1個<br>攻擊中的其他英雄。",
    		descriptionRaw: "此牌在本牌局首次攻擊時，從我方牌組或手牌召喚1個攻擊中的其他英雄。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI031.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI031-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 3,
    		health: 4,
    		description: "<link=vocab.Attack><style=Vocab>攻擊</style></link>：<br>場上每有1個<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>友軍單位，<br>則賦予此牌+1|+0。",
    		descriptionRaw: "攻擊：場上每有1個閃靈友軍單位，則賦予此牌+1|+0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI034.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI034-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "若本回合有友軍單位陣亡，則可對1個單位造成4點傷害。",
    		descriptionRaw: "若本回合有友軍單位陣亡，則可對1個單位造成4點傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI043.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI043-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI009.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI009-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 3,
    		cost: 2,
    		health: 2,
    		description: "<link=vocab.Support><style=Vocab>支援</style></link>：賦予受此牌支援的友軍單位+2|+0與<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。",
    		descriptionRaw: "支援：賦予受此牌支援的友軍單位+2|+0與閃靈。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "有些人只在殞落王者的詛咒中看見毀滅與痛苦，有些人卻能抱著「今朝有酒今朝醉」的心態，<br>及時行樂去囉。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI007T1"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI007.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI007-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI007T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI007T1-full.png"
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI056.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI056-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 3,
    		cost: 3,
    		health: 2,
    		description: "召喚此牌時，<br>本回合給予我方其他蜘蛛單位+1|+0，<br>並使所有敵軍單位<nobr>-1|-0</nobr>。",
    		descriptionRaw: "召喚此牌時，本回合給予我方其他蜘蛛單位+1|+0，並使所有敵軍單位-1|-0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI001.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI001-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI019.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI019-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 4,
    		health: 0,
    		description: "對本回合召喚的所有敵軍單位<br>造成3點傷害。",
    		descriptionRaw: "對本回合召喚的所有敵軍單位造成3點傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI011.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI011-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI014.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI014-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 2,
    		cost: 2,
    		health: 2,
    		description: "召喚此牌時，<br>賦予我方<link=vocab.Everywhere><style=Vocab>各處</style></link>的霧魅+1|+0。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI022.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI022-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 1,
    		health: 0,
    		description: "賦予1個友軍單位<br>+2|+2與<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI006.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI006-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "本回合控制1個敵軍侍從單位。<br>（若我方場上已有6個友軍單位，<br>則無法打出此牌。）",
    		descriptionRaw: "本回合控制1個敵軍侍從單位。（若我方場上已有6個友軍單位，則無法打出此牌。）",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI033"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI033T1.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI033T1-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "對敵方主堡造成<br>等同其當前一半生命值的傷害，<br>無條件進位。",
    		descriptionRaw: "對敵方主堡造成等同其當前一半生命值的傷害，無條件進位。",
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
    		collectible: false,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI028.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI028-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "選擇1個友軍單位，<br>召喚1個與之相同的複製單位，<br>其為<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>且能力值為1|1。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI025.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI025-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "擊殺1個友軍單位，並對任1目標<br>造成等同該單位力量值的傷害。",
    		descriptionRaw: "擊殺1個友軍單位，並對任1目標造成等同該單位力量值的傷害。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI046.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI046-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 3,
    		health: 0,
    		description: "隨機復甦1個本回合陣亡的<br>友軍單位。",
    		descriptionRaw: "隨機復甦1個本回合陣亡的友軍單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "「那陣黯霧會活生生割除人類的靈魂，留下一具半死不活的軀體。我曾親眼目睹家鄉遭到蹂躪，所以我要前往那些受到詛咒的島嶼，了結這一切。」<br>——無畏守備官，阿里．倫斯",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI050.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI050-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 6,
    		health: 0,
    		description: "召喚3個<link=card.summon><style=AssociatedCard>小蜘蛛</style></link>，<br>並賦予我方蜘蛛單位+1|+0。 ",
    		descriptionRaw: "召喚3個小蜘蛛，並賦予我方蜘蛛單位+1|+0。 ",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI014"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI016.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI016-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI021.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI021-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 3,
    		cost: 2,
    		health: 1,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：<br>下次有<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>友軍單位攻擊時，<br>此牌將復甦並攻擊。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI032.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI032-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 3,
    		cost: 4,
    		health: 3,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：<br>擊殺1個友軍單位，再將其復甦。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI058.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI058-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 4,
    		cost: 5,
    		health: 3,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：擊殺1個友軍單位，<br>並隨機召喚1個<br>魔耗值高出2點的侍從單位。",
    		descriptionRaw: "出牌：擊殺1個友軍單位，並隨機召喚1個魔耗值高出2點的侍從單位。",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "怨靈們，把聲音借給我！我們將協力召出<br>無盡的黑暗！",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI054.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI054-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "從任1單位<link=keyword.Drain><style=Keyword>汲取</style></link>3點生命值",
    		descriptionRaw: "從任1單位汲取3點生命值",
    		levelupDescription: "",
    		levelupDescriptionRaw: "",
    		flavorText: "亡者別無所求，只想讓生者不間斷的心跳聲<br>停歇下來。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI044.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI044-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 6,
    		cost: 8,
    		health: 6,
    		description: "<link=vocab.Play><style=Vocab>出牌</style></link>：選擇1個手牌中的友軍單位，<br>召喚1個與之相同的複製單位，<br>其為<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>。",
    		descriptionRaw: "出牌：選擇1個手牌中的友軍單位，召喚1個與之相同的複製單位，其為閃靈。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI039.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI039-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI020.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI020-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI029.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI029-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 5,
    		health: 0,
    		description: "對所有敵軍單位造成1點傷害，<br>並治癒我方主堡3點生命。",
    		descriptionRaw: "對所有敵軍單位造成1點傷害，並治癒我方主堡3點生命。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI004.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI004-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI026.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI026-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 1,
    		cost: 1,
    		health: 1,
    		description: "<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>：在手牌生成1張<br>魔耗值3點或以下的<br>其他<link=keyword.Last Breath><sprite name=LastBreath><style=Keyword>遺願</style></link>侍從牌。",
    		descriptionRaw: "遺願：在手牌生成1張魔耗值3點或以下的其他遺願侍從牌。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    			"01SI002"
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI040.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI040-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 2,
    		health: 0,
    		description: "從1個單位<link=keyword.Drain><style=Keyword>汲取</style></link>1點生命值，<br>召喚1個<link=card.create><style=AssociatedCard>小蜘蛛</style></link>。",
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI015.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI015-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI055.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI055-full.png"
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
    		collectible: true,
    		set: "Set1"
    	},
    	{
    		associatedCards: [
    		],
    		associatedCardRefs: [
    		],
    		assets: [
    			{
    				gameAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI047.png",
    				fullAbsolutePath: "http://dd.b.pvp.net/1_14_0/set1/zh_tw/img/cards/01SI047-full.png"
    			}
    		],
    		region: "闇影島",
    		regionRef: "ShadowIsles",
    		attack: 0,
    		cost: 0,
    		health: 0,
    		description: "選1個侍從單位。<br>在手牌生成1張<br>與之相同的<link=keyword.Ephemeral><sprite name=Ephemeral><style=Keyword>閃靈</style></link>複製牌。",
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
    		collectible: true,
    		set: "Set1"
    	}
    ];

    /* src/Sets.svelte generated by Svelte v3.24.1 */

    const cardSets = {};
    cardSets[1] = set1;
    cardSets[2] = set2;
    cardSets[3] = set3;

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

    var maybeMap = function maybeMap(val, fn) {
        if (isArray(val)) {
            var mapped = [];
            for (var i = 0; i < val.length; i += 1) {
                mapped.push(fn(val[i]));
            }
            return mapped;
        }
        return fn(val);
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
        maybeMap: maybeMap,
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
            obj = utils.maybeMap(obj, function (value) {
                if (value instanceof Date) {
                    return serializeDate(value);
                }
                return value;
            }).join(',');
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
            var value = obj[key];

            if (skipNulls && value === null) {
                continue;
            }

            var keyPrefix = isArray$1(obj)
                ? typeof generateArrayPrefix === 'function' ? generateArrayPrefix(prefix, key) : prefix
                : prefix + (allowDots ? '.' + key : '[' + key + ']');

            pushToArray(values, stringify(
                value,
                keyPrefix,
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
                val = utils.maybeMap(
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

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/CardBar.svelte generated by Svelte v3.24.1 */
    const file = "src/CardBar.svelte";

    // (195:2) {#if hovering}
    function create_if_block(ctx) {
    	let img;
    	let img_src_value;
    	let img_transition;
    	let current;

    	const block = {
    		c: function create() {
    			img = element("img");
    			if (img.src !== (img_src_value = /*src2*/ ctx[3])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "class", "hoverview svelte-1drag83");
    			attr_dev(img, "alt", /*name*/ ctx[4]);
    			add_location(img, file, 195, 4, 3832);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*src2*/ 8 && img.src !== (img_src_value = /*src2*/ ctx[3])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (!current || dirty & /*name*/ 16) {
    				attr_dev(img, "alt", /*name*/ ctx[4]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!img_transition) img_transition = create_bidirectional_transition(img, fly, { y: 200, duration: 500 }, true);
    				img_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!img_transition) img_transition = create_bidirectional_transition(img, fly, { y: 200, duration: 500 }, false);
    			img_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			if (detaching && img_transition) img_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(195:2) {#if hovering}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let hover;
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
    	let t5;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*hovering*/ ctx[0] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			hover = element("hover");
    			cardblock = element("cardblock");
    			region_1 = element("region");
    			div0 = element("div");
    			span = element("span");
    			t0 = text(/*cost*/ ctx[5]);
    			t1 = space();
    			div1 = element("div");
    			t2 = text(/*name*/ ctx[4]);
    			t3 = space();
    			div2 = element("div");
    			t4 = text(/*count*/ ctx[1]);
    			t5 = space();
    			if (if_block) if_block.c();
    			add_location(span, file, 188, 8, 3666);
    			attr_dev(div0, "class", "cardcost svelte-1drag83");
    			add_location(div0, file, 187, 6, 3635);
    			attr_dev(div1, "class", "cardname svelte-1drag83");
    			add_location(div1, file, 190, 6, 3705);
    			attr_dev(div2, "class", "cardnums svelte-1drag83");
    			add_location(div2, file, 191, 6, 3746);
    			attr_dev(region_1, "class", region_1_class_value = "" + (null_to_empty(/*region*/ ctx[6]) + " svelte-1drag83"));
    			add_location(region_1, file, 186, 4, 3605);
    			set_style(cardblock, "background-image", "url(" + /*src*/ ctx[2] + ")");
    			attr_dev(cardblock, "class", "svelte-1drag83");
    			add_location(cardblock, file, 185, 2, 3552);
    			attr_dev(hover, "class", "svelte-1drag83");
    			add_location(hover, file, 184, 0, 3498);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, hover, anchor);
    			append_dev(hover, cardblock);
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
    			append_dev(hover, t5);
    			if (if_block) if_block.m(hover, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(hover, "mouseenter", /*enter*/ ctx[7], false, false, false),
    					listen_dev(hover, "mouseleave", /*leave*/ ctx[8], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*cost*/ 32) set_data_dev(t0, /*cost*/ ctx[5]);
    			if (!current || dirty & /*name*/ 16) set_data_dev(t2, /*name*/ ctx[4]);
    			if (!current || dirty & /*count*/ 2) set_data_dev(t4, /*count*/ ctx[1]);

    			if (!current || dirty & /*region*/ 64 && region_1_class_value !== (region_1_class_value = "" + (null_to_empty(/*region*/ ctx[6]) + " svelte-1drag83"))) {
    				attr_dev(region_1, "class", region_1_class_value);
    			}

    			if (!current || dirty & /*src*/ 4) {
    				set_style(cardblock, "background-image", "url(" + /*src*/ ctx[2] + ")");
    			}

    			if (/*hovering*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*hovering*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(hover, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(hover);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
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
    	let hovering = false;

    	function enter() {
    		$$invalidate(0, hovering = true);
    	}

    	function leave() {
    		$$invalidate(0, hovering = false);
    	}

    	let { card } = $$props;
    	let set;
    	let code;
    	let count;
    	let index;
    	let src;
    	let src2;
    	let name;
    	let cost;
    	let region;

    	beforeUpdate(() => {
    		set = card.set;
    		code = card.code;
    		$$invalidate(1, count = card.count);
    		index = cardSets[set].findIndex(obj => obj.cardCode == code);
    		$$invalidate(2, src = cardSets[set][index].assets[0].fullAbsolutePath);

    		// src = "img/cards/" + code + "-full.png";
    		$$invalidate(3, src2 = cardSets[set][index].assets[0].gameAbsolutePath);

    		// src2 = "img/cards/" + code + ".png";
    		$$invalidate(4, name = cardSets[set][index].name);

    		$$invalidate(5, cost = cardSets[set][index].cost);
    		$$invalidate(6, region = cardSets[set][index].regionRef);
    	});

    	const writable_props = ["card"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<CardBar> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("CardBar", $$slots, []);

    	$$self.$$set = $$props => {
    		if ("card" in $$props) $$invalidate(9, card = $$props.card);
    	};

    	$$self.$capture_state = () => ({
    		cardSets,
    		fly,
    		beforeUpdate,
    		afterUpdate,
    		hovering,
    		enter,
    		leave,
    		card,
    		set,
    		code,
    		count,
    		index,
    		src,
    		src2,
    		name,
    		cost,
    		region
    	});

    	$$self.$inject_state = $$props => {
    		if ("hovering" in $$props) $$invalidate(0, hovering = $$props.hovering);
    		if ("card" in $$props) $$invalidate(9, card = $$props.card);
    		if ("set" in $$props) set = $$props.set;
    		if ("code" in $$props) code = $$props.code;
    		if ("count" in $$props) $$invalidate(1, count = $$props.count);
    		if ("index" in $$props) index = $$props.index;
    		if ("src" in $$props) $$invalidate(2, src = $$props.src);
    		if ("src2" in $$props) $$invalidate(3, src2 = $$props.src2);
    		if ("name" in $$props) $$invalidate(4, name = $$props.name);
    		if ("cost" in $$props) $$invalidate(5, cost = $$props.cost);
    		if ("region" in $$props) $$invalidate(6, region = $$props.region);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [hovering, count, src, src2, name, cost, region, enter, leave, card];
    }

    class CardBar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { card: 9 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CardBar",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*card*/ ctx[9] === undefined && !("card" in props)) {
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

    /* src/App.svelte generated by Svelte v3.24.1 */

    const { console: console_1 } = globals;
    const file$1 = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    // (134:4) {#each heroes as card}
    function create_each_block_3(ctx) {
    	let cardbar;
    	let current;

    	cardbar = new CardBar({
    			props: { card: /*card*/ ctx[10] },
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
    			if (dirty & /*heroes*/ 2) cardbar_changes.card = /*card*/ ctx[10];
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
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(134:4) {#each heroes as card}",
    		ctx
    	});

    	return block;
    }

    // (137:4) {#if landmarks.length>0}
    function create_if_block$1(ctx) {
    	let h1;
    	let t0;
    	let count;
    	let t1_value = /*landmarks*/ ctx[4].length + "";
    	let t1;
    	let t2;
    	let each_1_anchor;
    	let current;
    	let each_value_2 = /*landmarks*/ ctx[4];
    	validate_each_argument(each_value_2);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t0 = text("地標:\n      ");
    			count = element("count");
    			t1 = text(t1_value);
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    			attr_dev(count, "class", "svelte-dhmvfu");
    			add_location(count, file$1, 139, 6, 2907);
    			attr_dev(h1, "class", "svelte-dhmvfu");
    			add_location(h1, file$1, 137, 6, 2886);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t0);
    			append_dev(h1, count);
    			append_dev(count, t1);
    			insert_dev(target, t2, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*landmarks*/ 16) && t1_value !== (t1_value = /*landmarks*/ ctx[4].length + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*landmarks*/ 16) {
    				each_value_2 = /*landmarks*/ ctx[4];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value_2.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_2.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t2);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(137:4) {#if landmarks.length>0}",
    		ctx
    	});

    	return block;
    }

    // (142:4) {#each landmarks as card}
    function create_each_block_2(ctx) {
    	let cardbar;
    	let current;

    	cardbar = new CardBar({
    			props: { card: /*card*/ ctx[10] },
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
    			if (dirty & /*landmarks*/ 16) cardbar_changes.card = /*card*/ ctx[10];
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
    		source: "(142:4) {#each landmarks as card}",
    		ctx
    	});

    	return block;
    }

    // (153:4) {#each minions as card}
    function create_each_block_1(ctx) {
    	let cardbar;
    	let current;

    	cardbar = new CardBar({
    			props: { card: /*card*/ ctx[10] },
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
    			if (dirty & /*minions*/ 4) cardbar_changes.card = /*card*/ ctx[10];
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
    		source: "(153:4) {#each minions as card}",
    		ctx
    	});

    	return block;
    }

    // (162:4) {#each spells as card}
    function create_each_block(ctx) {
    	let cardbar;
    	let current;

    	cardbar = new CardBar({
    			props: { card: /*card*/ ctx[10] },
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
    			if (dirty & /*spells*/ 8) cardbar_changes.card = /*card*/ ctx[10];
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
    		source: "(162:4) {#each spells as card}",
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
    	let t7;
    	let div1;
    	let h11;
    	let t8;
    	let count1;
    	let t9_value = /*minions*/ ctx[2].length + "";
    	let t9;
    	let t10;
    	let t11;
    	let div2;
    	let h12;
    	let t12;
    	let count2;
    	let t13_value = /*spells*/ ctx[3].length + "";
    	let t13;
    	let t14;
    	let t15;
    	let hr;
    	let t16;
    	let footer;
    	let a0;
    	let svg0;
    	let title0;
    	let t17;
    	let path0;
    	let t18;
    	let t19;
    	let a1;
    	let svg1;
    	let title1;
    	let t20;
    	let path1;
    	let t21;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value_3 = /*heroes*/ ctx[1];
    	validate_each_argument(each_value_3);
    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks_2[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	const out = i => transition_out(each_blocks_2[i], 1, 1, () => {
    		each_blocks_2[i] = null;
    	});

    	let if_block = /*landmarks*/ ctx[4].length > 0 && create_if_block$1(ctx);
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
    			if (if_block) if_block.c();
    			t7 = space();
    			div1 = element("div");
    			h11 = element("h1");
    			t8 = text("侍從:\n      ");
    			count1 = element("count");
    			t9 = text(t9_value);
    			t10 = space();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t11 = space();
    			div2 = element("div");
    			h12 = element("h1");
    			t12 = text("法術:\n      ");
    			count2 = element("count");
    			t13 = text(t13_value);
    			t14 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t15 = space();
    			hr = element("hr");
    			t16 = space();
    			footer = element("footer");
    			a0 = element("a");
    			svg0 = svg_element("svg");
    			title0 = svg_element("title");
    			t17 = text("Facebook icon");
    			path0 = svg_element("path");
    			t18 = text("\n    符文大地情報站");
    			t19 = space();
    			a1 = element("a");
    			svg1 = svg_element("svg");
    			title1 = svg_element("title");
    			t20 = text("GitHub icon");
    			path1 = svg_element("path");
    			t21 = text("\n    原始碼");
    			attr_dev(label, "class", "svelte-dhmvfu");
    			add_location(label, file$1, 123, 2, 2599);
    			attr_dev(input, "placeholder", "將代碼貼在此");
    			attr_dev(input, "class", "svelte-dhmvfu");
    			add_location(input, file$1, 124, 2, 2621);
    			attr_dev(deckcode_1, "class", "svelte-dhmvfu");
    			add_location(deckcode_1, file$1, 122, 0, 2586);
    			attr_dev(count0, "class", "svelte-dhmvfu");
    			add_location(count0, file$1, 131, 6, 2746);
    			attr_dev(h10, "class", "svelte-dhmvfu");
    			add_location(h10, file$1, 129, 4, 2725);
    			attr_dev(div0, "class", "svelte-dhmvfu");
    			add_location(div0, file$1, 128, 2, 2715);
    			attr_dev(count1, "class", "svelte-dhmvfu");
    			add_location(count1, file$1, 150, 6, 3071);
    			attr_dev(h11, "class", "svelte-dhmvfu");
    			add_location(h11, file$1, 148, 4, 3050);
    			attr_dev(div1, "class", "svelte-dhmvfu");
    			add_location(div1, file$1, 146, 2, 3039);
    			attr_dev(count2, "class", "svelte-dhmvfu");
    			add_location(count2, file$1, 159, 6, 3220);
    			attr_dev(h12, "class", "svelte-dhmvfu");
    			add_location(h12, file$1, 157, 4, 3199);
    			attr_dev(div2, "class", "svelte-dhmvfu");
    			add_location(div2, file$1, 156, 2, 3189);
    			attr_dev(main, "class", "svelte-dhmvfu");
    			add_location(main, file$1, 127, 0, 2706);
    			attr_dev(hr, "class", "svelte-dhmvfu");
    			add_location(hr, file$1, 167, 0, 3343);
    			add_location(title0, file$1, 176, 6, 3528);
    			attr_dev(path0, "d", "M23.9981 11.9991C23.9981 5.37216 18.626 0 11.9991 0C5.37216 0 0\n        5.37216 0 11.9991C0 17.9882 4.38789 22.9522 10.1242\n        23.8524V15.4676H7.07758V11.9991H10.1242V9.35553C10.1242 6.34826 11.9156\n        4.68714 14.6564 4.68714C15.9692 4.68714 17.3424 4.92149 17.3424\n        4.92149V7.87439H15.8294C14.3388 7.87439 13.8739 8.79933 13.8739\n        9.74824V11.9991H17.2018L16.6698 15.4676H13.8739V23.8524C19.6103 22.9522\n        23.9981 17.9882 23.9981 11.9991Z");
    			add_location(path0, file$1, 177, 6, 3563);
    			attr_dev(svg0, "class", "social svelte-dhmvfu");
    			attr_dev(svg0, "role", "img");
    			attr_dev(svg0, "viewBox", "0 0 24 24");
    			attr_dev(svg0, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg0, file$1, 171, 4, 3411);
    			attr_dev(a0, "href", "https://www.facebook.com/LoRFanTW");
    			attr_dev(a0, "class", "svelte-dhmvfu");
    			add_location(a0, file$1, 170, 2, 3362);
    			add_location(title1, file$1, 195, 6, 4267);
    			attr_dev(path1, "d", "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205\n        11.385.6.113.82-.258.82-.577\n        0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07\n        3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838\n        1.236 1.838 1.236 1.07 1.835 2.809 1.305\n        3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93\n        0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322\n        3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552\n        3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23\n        3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015\n        2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24\n        12.297c0-6.627-5.373-12-12-12");
    			add_location(path1, file$1, 196, 6, 4300);
    			attr_dev(svg1, "class", "social svelte-dhmvfu");
    			attr_dev(svg1, "role", "img");
    			attr_dev(svg1, "viewBox", "0 0 24 24");
    			attr_dev(svg1, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg1, file$1, 190, 4, 4150);
    			attr_dev(a1, "href", "https://github.com/jotarun/runeterradeckviewer");
    			attr_dev(a1, "class", "svelte-dhmvfu");
    			add_location(a1, file$1, 189, 2, 4088);
    			attr_dev(footer, "class", "svelte-dhmvfu");
    			add_location(footer, file$1, 169, 0, 3351);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
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

    			append_dev(div0, t6);
    			if (if_block) if_block.m(div0, null);
    			append_dev(main, t7);
    			append_dev(main, div1);
    			append_dev(div1, h11);
    			append_dev(h11, t8);
    			append_dev(h11, count1);
    			append_dev(count1, t9);
    			append_dev(div1, t10);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div1, null);
    			}

    			append_dev(main, t11);
    			append_dev(main, div2);
    			append_dev(div2, h12);
    			append_dev(h12, t12);
    			append_dev(h12, count2);
    			append_dev(count2, t13);
    			append_dev(div2, t14);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			insert_dev(target, t15, anchor);
    			insert_dev(target, hr, anchor);
    			insert_dev(target, t16, anchor);
    			insert_dev(target, footer, anchor);
    			append_dev(footer, a0);
    			append_dev(a0, svg0);
    			append_dev(svg0, title0);
    			append_dev(title0, t17);
    			append_dev(svg0, path0);
    			append_dev(a0, t18);
    			append_dev(footer, t19);
    			append_dev(footer, a1);
    			append_dev(a1, svg1);
    			append_dev(svg1, title1);
    			append_dev(title1, t20);
    			append_dev(svg1, path1);
    			append_dev(a1, t21);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", /*decode*/ ctx[5], false, false, false),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[6])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*deckcode*/ 1 && input.value !== /*deckcode*/ ctx[0]) {
    				set_input_value(input, /*deckcode*/ ctx[0]);
    			}

    			if ((!current || dirty & /*heroes*/ 2) && t4_value !== (t4_value = /*heroes*/ ctx[1].length + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*heroes*/ 2) {
    				each_value_3 = /*heroes*/ ctx[1];
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks_2[i]) {
    						each_blocks_2[i].p(child_ctx, dirty);
    						transition_in(each_blocks_2[i], 1);
    					} else {
    						each_blocks_2[i] = create_each_block_3(child_ctx);
    						each_blocks_2[i].c();
    						transition_in(each_blocks_2[i], 1);
    						each_blocks_2[i].m(div0, t6);
    					}
    				}

    				group_outros();

    				for (i = each_value_3.length; i < each_blocks_2.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (/*landmarks*/ ctx[4].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*landmarks*/ 16) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div0, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if ((!current || dirty & /*minions*/ 4) && t9_value !== (t9_value = /*minions*/ ctx[2].length + "")) set_data_dev(t9, t9_value);

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

    			if ((!current || dirty & /*spells*/ 8) && t13_value !== (t13_value = /*spells*/ ctx[3].length + "")) set_data_dev(t13, t13_value);

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

    			for (let i = 0; i < each_value_3.length; i += 1) {
    				transition_in(each_blocks_2[i]);
    			}

    			transition_in(if_block);

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

    			transition_out(if_block);
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
    			if (if_block) if_block.d();
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t15);
    			if (detaching) detach_dev(hr);
    			if (detaching) detach_dev(t16);
    			if (detaching) detach_dev(footer);
    			mounted = false;
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
    	let landmarks = {};
    	decode();

    	function decode() {
    		deck = src_1.decode(deckcode);

    		deck.forEach((o, i, a) => {
    			let set = a[i].set;
    			console.log(set);
    			let index = cardSets[set].findIndex(obj => obj.cardCode == a[i].code);
    			a[i].supertype = cardSets[set][index].supertype;
    			a[i].type = cardSets[set][index].type;
    			a[i].cost = cardSets[set][index].cost;
    		});

    		$$invalidate(1, heroes = deck.filter(card => card.supertype == "英雄"));
    		$$invalidate(4, landmarks = deck.filter(card => card.type == "地標"));
    		$$invalidate(2, minions = deck.filter(card => card.type == "單位" && card.supertype == ""));
    		$$invalidate(3, spells = deck.filter(card => card.type == "法術"));
    		sortdeck(heroes);
    		sortdeck(landmarks);
    		sortdeck(minions);
    		sortdeck(spells);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
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
    		landmarks,
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
    		if ("landmarks" in $$props) $$invalidate(4, landmarks = $$props.landmarks);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [deckcode, heroes, minions, spells, landmarks, decode, input_input_handler];
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
