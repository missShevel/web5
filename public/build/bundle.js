
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
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
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function get_store_value(store) {
        let value;
        subscribe(store, _ => value = _)();
        return value;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
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
    function element(name) {
        return document.createElement(name);
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
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
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
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
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
        seen_callbacks.clear();
        set_current_component(saved_component);
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
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
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
        }
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
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
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
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
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
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.3' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
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
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const notes = writable([]);

    const isAuthenticated = writable(false);
    const user = writable({});
    const popupOpen = writable(false);

    const token = writable("");

    class RequestRunner {
      constructor() {
        this.API_URL = "https://weblabaa5.herokuapp.com/v1/graphql";
      }
      async fetchGraphQL(operationsDoc, operationName, variables) {
        const result = await fetch(this.API_URL, {
          method: "POST",
          body: JSON.stringify({
            query: operationsDoc,
            variables: variables,
            operationName: operationName,
          }),
          headers: { Authorization: `Bearer ${get_store_value(token)}` },
        });
        return await result.json();
      }
      fetchMyQuery(operationsDoc) {
        return this.fetchGraphQL(operationsDoc, "MyQuery", {});
      }

      async startFetchMyQuery(operationsDoc) {
        const { errors, data } = await this.fetchMyQuery(operationsDoc);

        if (errors) {
          // handle those errors like a pro
          console.error(errors);
        }

        // do something great with this precious data
        console.log(data);
        return data;
      }

      executeMyMutation(operationsDoc, variables = {}) {
        return this.fetchGraphQL(operationsDoc, "MyMutation", variables);
      }

      async startExecuteMyMutation(operationsDoc, variables = {}) {
        const { errors, data } = await this.executeMyMutation(
          operationsDoc,
          variables
        );

        if (errors) {
          // handle those errors like a pro
          console.error(errors);
        }

        // do something great with this precious data
        console.log(data);
        return data;
      }
    }
    var requestRunner = new RequestRunner();

    class OperationsDocsHelper {
      static QUERY_GetAll = () =>
        `query MyQuery {
    notes_notes {
      creation_time
      deadline
      id
      note_details
      note_title
      status
      number
    }
  }
`;
      static MUTATION_InsertOne = (title, status) => `mutation MyMutation {
        insert_notes_notes(objects: {note_title: "${title}", status: "${status}"}) {
          returning {
            id
            creation_time
            deadline
            note_details
            note_title
            status
            number
          }
        }
      }
      `;

      static MUTATION_DeleteByStatus = () => `
      mutation MyMutation($status:String) {
        delete_notes_notes(where: {status: {_eq: $status}}) {
          returning {
            id
            deadline
            creation_time
            note_details
            note_title
            status
            number
          }
        }
      }`;

      static MUTATION_DeleteByNumber = () => `
      mutation MyMutation($number:Int) {
        delete_notes_notes(where: {number: {_eq: $number}}) {
          returning {
            creation_time
            id
            note_title
            number
            status
          }
        }
      }
      `;
    }

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    var e=function(t,n){return (e=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t;}||function(e,t){for(var n in t)Object.prototype.hasOwnProperty.call(t,n)&&(e[n]=t[n]);})(t,n)};function t(t,n){if("function"!=typeof n&&null!==n)throw new TypeError("Class extends value "+String(n)+" is not a constructor or null");function r(){this.constructor=t;}e(t,n),t.prototype=null===n?Object.create(n):(r.prototype=n.prototype,new r);}var n=function(){return (n=Object.assign||function(e){for(var t,n=1,r=arguments.length;n<r;n++)for(var o in t=arguments[n])Object.prototype.hasOwnProperty.call(t,o)&&(e[o]=t[o]);return e}).apply(this,arguments)};function r(e,t){var n={};for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&t.indexOf(r)<0&&(n[r]=e[r]);if(null!=e&&"function"==typeof Object.getOwnPropertySymbols){var o=0;for(r=Object.getOwnPropertySymbols(e);o<r.length;o++)t.indexOf(r[o])<0&&Object.prototype.propertyIsEnumerable.call(e,r[o])&&(n[r[o]]=e[r[o]]);}return n}function o(e,t,n,r){return new(n||(n=Promise))((function(o,i){function a(e){try{s(r.next(e));}catch(e){i(e);}}function c(e){try{s(r.throw(e));}catch(e){i(e);}}function s(e){var t;e.done?o(e.value):(t=e.value,t instanceof n?t:new n((function(e){e(t);}))).then(a,c);}s((r=r.apply(e,t||[])).next());}))}function i(e,t){var n,r,o,i,a={label:0,sent:function(){if(1&o[0])throw o[1];return o[1]},trys:[],ops:[]};return i={next:c(0),throw:c(1),return:c(2)},"function"==typeof Symbol&&(i[Symbol.iterator]=function(){return this}),i;function c(i){return function(c){return function(i){if(n)throw new TypeError("Generator is already executing.");for(;a;)try{if(n=1,r&&(o=2&i[0]?r.return:i[0]?r.throw||((o=r.return)&&o.call(r),0):r.next)&&!(o=o.call(r,i[1])).done)return o;switch(r=0,o&&(i=[2&i[0],o.value]),i[0]){case 0:case 1:o=i;break;case 4:return a.label++,{value:i[1],done:!1};case 5:a.label++,r=i[1],i=[0];continue;case 7:i=a.ops.pop(),a.trys.pop();continue;default:if(!(o=a.trys,(o=o.length>0&&o[o.length-1])||6!==i[0]&&2!==i[0])){a=0;continue}if(3===i[0]&&(!o||i[1]>o[0]&&i[1]<o[3])){a.label=i[1];break}if(6===i[0]&&a.label<o[1]){a.label=o[1],o=i;break}if(o&&a.label<o[2]){a.label=o[2],a.ops.push(i);break}o[2]&&a.ops.pop(),a.trys.pop();continue}i=t.call(e,a);}catch(e){i=[6,e],r=0;}finally{n=o=0;}if(5&i[0])throw i[1];return {value:i[0]?i[1]:void 0,done:!0}}([i,c])}}}function a(e,t){var n="function"==typeof Symbol&&e[Symbol.iterator];if(!n)return e;var r,o,i=n.call(e),a=[];try{for(;(void 0===t||t-- >0)&&!(r=i.next()).done;)a.push(r.value);}catch(e){o={error:e};}finally{try{r&&!r.done&&(n=i.return)&&n.call(i);}finally{if(o)throw o.error}}return a}function c(e,t,n){if(n||2===arguments.length)for(var r,o=0,i=t.length;o<i;o++)!r&&o in t||(r||(r=Array.prototype.slice.call(t,0,o)),r[o]=t[o]);return e.concat(r||Array.prototype.slice.call(t))}var s="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:{};function u(e){return e&&e.__esModule&&Object.prototype.hasOwnProperty.call(e,"default")?e.default:e}function l(e,t){return e(t={exports:{}},t.exports),t.exports}var f,d,h=function(e){return e&&e.Math==Math&&e},p=h("object"==typeof globalThis&&globalThis)||h("object"==typeof window&&window)||h("object"==typeof self&&self)||h("object"==typeof s&&s)||function(){return this}()||Function("return this")(),y=function(e){try{return !!e()}catch(e){return !0}},v=!y((function(){return 7!=Object.defineProperty({},1,{get:function(){return 7}})[1]})),m=Function.prototype.call,g=m.bind?m.bind(m):function(){return m.apply(m,arguments)},b={}.propertyIsEnumerable,w=Object.getOwnPropertyDescriptor,S={f:w&&!b.call({1:2},1)?function(e){var t=w(this,e);return !!t&&t.enumerable}:b},_=function(e,t){return {enumerable:!(1&e),configurable:!(2&e),writable:!(4&e),value:t}},k=Function.prototype,I=k.bind,T=k.call,O=I&&I.bind(T),E=I?function(e){return e&&O(T,e)}:function(e){return e&&function(){return T.apply(e,arguments)}},x=E({}.toString),C=E("".slice),R=function(e){return C(x(e),8,-1)},F=p.Object,A=E("".split),j=y((function(){return !F("z").propertyIsEnumerable(0)}))?function(e){return "String"==R(e)?A(e,""):F(e)}:F,U=p.TypeError,K=function(e){if(null==e)throw U("Can't call method on "+e);return e},P=function(e){return j(K(e))},L=function(e){return "function"==typeof e},W=function(e){return "object"==typeof e?null!==e:L(e)},Z=function(e){return L(e)?e:void 0},V=function(e,t){return arguments.length<2?Z(p[e]):p[e]&&p[e][t]},N=E({}.isPrototypeOf),X=V("navigator","userAgent")||"",D=p.process,z=p.Deno,Y=D&&D.versions||z&&z.version,J=Y&&Y.v8;J&&(d=(f=J.split("."))[0]>0&&f[0]<4?1:+(f[0]+f[1])),!d&&X&&(!(f=X.match(/Edge\/(\d+)/))||f[1]>=74)&&(f=X.match(/Chrome\/(\d+)/))&&(d=+f[1]);var B=d,G=!!Object.getOwnPropertySymbols&&!y((function(){var e=Symbol();return !String(e)||!(Object(e)instanceof Symbol)||!Symbol.sham&&B&&B<41})),M=G&&!Symbol.sham&&"symbol"==typeof Symbol.iterator,H=p.Object,q=M?function(e){return "symbol"==typeof e}:function(e){var t=V("Symbol");return L(t)&&N(t.prototype,H(e))},Q=p.String,$=function(e){try{return Q(e)}catch(e){return "Object"}},ee=p.TypeError,te=function(e){if(L(e))return e;throw ee($(e)+" is not a function")},ne=function(e,t){var n=e[t];return null==n?void 0:te(n)},re=p.TypeError,oe=Object.defineProperty,ie=function(e,t){try{oe(p,e,{value:t,configurable:!0,writable:!0});}catch(n){p[e]=t;}return t},ae=p["__core-js_shared__"]||ie("__core-js_shared__",{}),ce=l((function(e){(e.exports=function(e,t){return ae[e]||(ae[e]=void 0!==t?t:{})})("versions",[]).push({version:"3.19.1",mode:"global",copyright:"© 2021 Denis Pushkarev (zloirock.ru)"});})),se=p.Object,ue=function(e){return se(K(e))},le=E({}.hasOwnProperty),fe=Object.hasOwn||function(e,t){return le(ue(e),t)},de=0,he=Math.random(),pe=E(1..toString),ye=function(e){return "Symbol("+(void 0===e?"":e)+")_"+pe(++de+he,36)},ve=ce("wks"),me=p.Symbol,ge=me&&me.for,be=M?me:me&&me.withoutSetter||ye,we=function(e){if(!fe(ve,e)||!G&&"string"!=typeof ve[e]){var t="Symbol."+e;G&&fe(me,e)?ve[e]=me[e]:ve[e]=M&&ge?ge(t):be(t);}return ve[e]},Se=p.TypeError,_e=we("toPrimitive"),ke=function(e,t){if(!W(e)||q(e))return e;var n,r=ne(e,_e);if(r){if(void 0===t&&(t="default"),n=g(r,e,t),!W(n)||q(n))return n;throw Se("Can't convert object to primitive value")}return void 0===t&&(t="number"),function(e,t){var n,r;if("string"===t&&L(n=e.toString)&&!W(r=g(n,e)))return r;if(L(n=e.valueOf)&&!W(r=g(n,e)))return r;if("string"!==t&&L(n=e.toString)&&!W(r=g(n,e)))return r;throw re("Can't convert object to primitive value")}(e,t)},Ie=function(e){var t=ke(e,"string");return q(t)?t:t+""},Te=p.document,Oe=W(Te)&&W(Te.createElement),Ee=function(e){return Oe?Te.createElement(e):{}},xe=!v&&!y((function(){return 7!=Object.defineProperty(Ee("div"),"a",{get:function(){return 7}}).a})),Ce=Object.getOwnPropertyDescriptor,Re={f:v?Ce:function(e,t){if(e=P(e),t=Ie(t),xe)try{return Ce(e,t)}catch(e){}if(fe(e,t))return _(!g(S.f,e,t),e[t])}},Fe=p.String,Ae=p.TypeError,je=function(e){if(W(e))return e;throw Ae(Fe(e)+" is not an object")},Ue=p.TypeError,Ke=Object.defineProperty,Pe={f:v?Ke:function(e,t,n){if(je(e),t=Ie(t),je(n),xe)try{return Ke(e,t,n)}catch(e){}if("get"in n||"set"in n)throw Ue("Accessors not supported");return "value"in n&&(e[t]=n.value),e}},Le=v?function(e,t,n){return Pe.f(e,t,_(1,n))}:function(e,t,n){return e[t]=n,e},We=E(Function.toString);L(ae.inspectSource)||(ae.inspectSource=function(e){return We(e)});var Ze,Ve,Ne,Xe=ae.inspectSource,De=p.WeakMap,ze=L(De)&&/native code/.test(Xe(De)),Ye=ce("keys"),Je=function(e){return Ye[e]||(Ye[e]=ye(e))},Be={},Ge=p.TypeError,Me=p.WeakMap;if(ze||ae.state){var He=ae.state||(ae.state=new Me),qe=E(He.get),Qe=E(He.has),$e=E(He.set);Ze=function(e,t){if(Qe(He,e))throw new Ge("Object already initialized");return t.facade=e,$e(He,e,t),t},Ve=function(e){return qe(He,e)||{}},Ne=function(e){return Qe(He,e)};}else {var et=Je("state");Be[et]=!0,Ze=function(e,t){if(fe(e,et))throw new Ge("Object already initialized");return t.facade=e,Le(e,et,t),t},Ve=function(e){return fe(e,et)?e[et]:{}},Ne=function(e){return fe(e,et)};}var tt={set:Ze,get:Ve,has:Ne,enforce:function(e){return Ne(e)?Ve(e):Ze(e,{})},getterFor:function(e){return function(t){var n;if(!W(t)||(n=Ve(t)).type!==e)throw Ge("Incompatible receiver, "+e+" required");return n}}},nt=Function.prototype,rt=v&&Object.getOwnPropertyDescriptor,ot=fe(nt,"name"),it={EXISTS:ot,PROPER:ot&&"something"===function(){}.name,CONFIGURABLE:ot&&(!v||v&&rt(nt,"name").configurable)},at=l((function(e){var t=it.CONFIGURABLE,n=tt.get,r=tt.enforce,o=String(String).split("String");(e.exports=function(e,n,i,a){var c,s=!!a&&!!a.unsafe,u=!!a&&!!a.enumerable,l=!!a&&!!a.noTargetGet,f=a&&void 0!==a.name?a.name:n;L(i)&&("Symbol("===String(f).slice(0,7)&&(f="["+String(f).replace(/^Symbol\(([^)]*)\)/,"$1")+"]"),(!fe(i,"name")||t&&i.name!==f)&&Le(i,"name",f),(c=r(i)).source||(c.source=o.join("string"==typeof f?f:""))),e!==p?(s?!l&&e[n]&&(u=!0):delete e[n],u?e[n]=i:Le(e,n,i)):u?e[n]=i:ie(n,i);})(Function.prototype,"toString",(function(){return L(this)&&n(this).source||Xe(this)}));})),ct=Math.ceil,st=Math.floor,ut=function(e){var t=+e;return t!=t||0===t?0:(t>0?st:ct)(t)},lt=Math.max,ft=Math.min,dt=Math.min,ht=function(e){return e>0?dt(ut(e),9007199254740991):0},pt=function(e){return ht(e.length)},yt=function(e){return function(t,n,r){var o,i=P(t),a=pt(i),c=function(e,t){var n=ut(e);return n<0?lt(n+t,0):ft(n,t)}(r,a);if(e&&n!=n){for(;a>c;)if((o=i[c++])!=o)return !0}else for(;a>c;c++)if((e||c in i)&&i[c]===n)return e||c||0;return !e&&-1}},vt={includes:yt(!0),indexOf:yt(!1)},mt=vt.indexOf,gt=E([].push),bt=function(e,t){var n,r=P(e),o=0,i=[];for(n in r)!fe(Be,n)&&fe(r,n)&&gt(i,n);for(;t.length>o;)fe(r,n=t[o++])&&(~mt(i,n)||gt(i,n));return i},wt=["constructor","hasOwnProperty","isPrototypeOf","propertyIsEnumerable","toLocaleString","toString","valueOf"],St=wt.concat("length","prototype"),_t={f:Object.getOwnPropertyNames||function(e){return bt(e,St)}},kt={f:Object.getOwnPropertySymbols},It=E([].concat),Tt=V("Reflect","ownKeys")||function(e){var t=_t.f(je(e)),n=kt.f;return n?It(t,n(e)):t},Ot=function(e,t){for(var n=Tt(t),r=Pe.f,o=Re.f,i=0;i<n.length;i++){var a=n[i];fe(e,a)||r(e,a,o(t,a));}},Et=/#|\.prototype\./,xt=function(e,t){var n=Rt[Ct(e)];return n==At||n!=Ft&&(L(t)?y(t):!!t)},Ct=xt.normalize=function(e){return String(e).replace(Et,".").toLowerCase()},Rt=xt.data={},Ft=xt.NATIVE="N",At=xt.POLYFILL="P",jt=xt,Ut=Re.f,Kt=function(e,t){var n,r,o,i,a,c=e.target,s=e.global,u=e.stat;if(n=s?p:u?p[c]||ie(c,{}):(p[c]||{}).prototype)for(r in t){if(i=t[r],o=e.noTargetGet?(a=Ut(n,r))&&a.value:n[r],!jt(s?r:c+(u?".":"#")+r,e.forced)&&void 0!==o){if(typeof i==typeof o)continue;Ot(i,o);}(e.sham||o&&o.sham)&&Le(i,"sham",!0),at(n,r,i,e);}},Pt={};Pt[we("toStringTag")]="z";var Lt,Wt="[object z]"===String(Pt),Zt=we("toStringTag"),Vt=p.Object,Nt="Arguments"==R(function(){return arguments}()),Xt=Wt?R:function(e){var t,n,r;return void 0===e?"Undefined":null===e?"Null":"string"==typeof(n=function(e,t){try{return e[t]}catch(e){}}(t=Vt(e),Zt))?n:Nt?R(t):"Object"==(r=R(t))&&L(t.callee)?"Arguments":r},Dt=p.String,zt=function(e){if("Symbol"===Xt(e))throw TypeError("Cannot convert a Symbol value to a string");return Dt(e)},Yt=we("match"),Jt=p.TypeError,Bt=function(e){if(function(e){var t;return W(e)&&(void 0!==(t=e[Yt])?!!t:"RegExp"==R(e))}(e))throw Jt("The method doesn't accept regular expressions");return e},Gt=we("match"),Mt=function(e){var t=/./;try{"/./"[e](t);}catch(n){try{return t[Gt]=!1,"/./"[e](t)}catch(e){}}return !1},Ht=Re.f,qt=E("".startsWith),Qt=E("".slice),$t=Math.min,en=Mt("startsWith"),tn=!(en||(Lt=Ht(String.prototype,"startsWith"),!Lt||Lt.writable));Kt({target:"String",proto:!0,forced:!tn&&!en},{startsWith:function(e){var t=zt(K(this));Bt(e);var n=ht($t(arguments.length>1?arguments[1]:void 0,t.length)),r=zt(e);return qt?qt(t,r,n):Qt(t,n,n+r.length)===r}});var nn=function(e,t){return E(p[e].prototype[t])};nn("String","startsWith");var rn,on=Array.isArray||function(e){return "Array"==R(e)},an=function(e,t,n){var r=Ie(t);r in e?Pe.f(e,r,_(0,n)):e[r]=n;},cn=function(){},sn=[],un=V("Reflect","construct"),ln=/^\s*(?:class|function)\b/,fn=E(ln.exec),dn=!ln.exec(cn),hn=function(e){if(!L(e))return !1;try{return un(cn,sn,e),!0}catch(e){return !1}},pn=!un||y((function(){var e;return hn(hn.call)||!hn(Object)||!hn((function(){e=!0;}))||e}))?function(e){if(!L(e))return !1;switch(Xt(e)){case"AsyncFunction":case"GeneratorFunction":case"AsyncGeneratorFunction":return !1}return dn||!!fn(ln,Xe(e))}:hn,yn=we("species"),vn=p.Array,mn=function(e,t){return new(function(e){var t;return on(e)&&(t=e.constructor,(pn(t)&&(t===vn||on(t.prototype))||W(t)&&null===(t=t[yn]))&&(t=void 0)),void 0===t?vn:t}(e))(0===t?0:t)},gn=we("species"),bn=we("isConcatSpreadable"),wn=p.TypeError,Sn=B>=51||!y((function(){var e=[];return e[bn]=!1,e.concat()[0]!==e})),_n=(rn="concat",B>=51||!y((function(){var e=[];return (e.constructor={})[gn]=function(){return {foo:1}},1!==e[rn](Boolean).foo}))),kn=function(e){if(!W(e))return !1;var t=e[bn];return void 0!==t?!!t:on(e)};Kt({target:"Array",proto:!0,forced:!Sn||!_n},{concat:function(e){var t,n,r,o,i,a=ue(this),c=mn(a,0),s=0;for(t=-1,r=arguments.length;t<r;t++)if(kn(i=-1===t?a:arguments[t])){if(s+(o=pt(i))>9007199254740991)throw wn("Maximum allowed index exceeded");for(n=0;n<o;n++,s++)n in i&&an(c,s,i[n]);}else {if(s>=9007199254740991)throw wn("Maximum allowed index exceeded");an(c,s++,i);}return c.length=s,c}});var In=Wt?{}.toString:function(){return "[object "+Xt(this)+"]"};Wt||at(Object.prototype,"toString",In,{unsafe:!0});var Tn,On=Function.prototype,En=On.apply,xn=On.bind,Cn=On.call,Rn="object"==typeof Reflect&&Reflect.apply||(xn?Cn.bind(En):function(){return Cn.apply(En,arguments)}),Fn=Object.keys||function(e){return bt(e,wt)},An=v?Object.defineProperties:function(e,t){je(e);for(var n,r=P(t),o=Fn(t),i=o.length,a=0;i>a;)Pe.f(e,n=o[a++],r[n]);return e},jn=V("document","documentElement"),Un=Je("IE_PROTO"),Kn=function(){},Pn=function(e){return "<script>"+e+"<\/script>"},Ln=function(e){e.write(Pn("")),e.close();var t=e.parentWindow.Object;return e=null,t},Wn=function(){try{Tn=new ActiveXObject("htmlfile");}catch(e){}var e,t;Wn="undefined"!=typeof document?document.domain&&Tn?Ln(Tn):((t=Ee("iframe")).style.display="none",jn.appendChild(t),t.src=String("javascript:"),(e=t.contentWindow.document).open(),e.write(Pn("document.F=Object")),e.close(),e.F):Ln(Tn);for(var n=wt.length;n--;)delete Wn.prototype[wt[n]];return Wn()};Be[Un]=!0;var Zn=Object.create||function(e,t){var n;return null!==e?(Kn.prototype=je(e),n=new Kn,Kn.prototype=null,n[Un]=e):n=Wn(),void 0===t?n:An(n,t)},Vn=E([].slice),Nn=_t.f,Xn="object"==typeof window&&window&&Object.getOwnPropertyNames?Object.getOwnPropertyNames(window):[],Dn={f:function(e){return Xn&&"Window"==R(e)?function(e){try{return Nn(e)}catch(e){return Vn(Xn)}}(e):Nn(P(e))}},zn={f:we},Yn=p,Jn=Pe.f,Bn=function(e){var t=Yn.Symbol||(Yn.Symbol={});fe(t,e)||Jn(t,e,{value:zn.f(e)});},Gn=Pe.f,Mn=we("toStringTag"),Hn=function(e,t,n){e&&!fe(e=n?e:e.prototype,Mn)&&Gn(e,Mn,{configurable:!0,value:t});},qn=E(E.bind),Qn=function(e,t){return te(e),void 0===t?e:qn?qn(e,t):function(){return e.apply(t,arguments)}},$n=E([].push),er=function(e){var t=1==e,n=2==e,r=3==e,o=4==e,i=6==e,a=7==e,c=5==e||i;return function(s,u,l,f){for(var d,h,p=ue(s),y=j(p),v=Qn(u,l),m=pt(y),g=0,b=f||mn,w=t?b(s,m):n||a?b(s,0):void 0;m>g;g++)if((c||g in y)&&(h=v(d=y[g],g,p),e))if(t)w[g]=h;else if(h)switch(e){case 3:return !0;case 5:return d;case 6:return g;case 2:$n(w,d);}else switch(e){case 4:return !1;case 7:$n(w,d);}return i?-1:r||o?o:w}},tr={forEach:er(0),map:er(1),filter:er(2),some:er(3),every:er(4),find:er(5),findIndex:er(6),filterReject:er(7)}.forEach,nr=Je("hidden"),rr=we("toPrimitive"),or=tt.set,ir=tt.getterFor("Symbol"),ar=Object.prototype,cr=p.Symbol,sr=cr&&cr.prototype,ur=p.TypeError,lr=p.QObject,fr=V("JSON","stringify"),dr=Re.f,hr=Pe.f,pr=Dn.f,yr=S.f,vr=E([].push),mr=ce("symbols"),gr=ce("op-symbols"),br=ce("string-to-symbol-registry"),wr=ce("symbol-to-string-registry"),Sr=ce("wks"),_r=!lr||!lr.prototype||!lr.prototype.findChild,kr=v&&y((function(){return 7!=Zn(hr({},"a",{get:function(){return hr(this,"a",{value:7}).a}})).a}))?function(e,t,n){var r=dr(ar,t);r&&delete ar[t],hr(e,t,n),r&&e!==ar&&hr(ar,t,r);}:hr,Ir=function(e,t){var n=mr[e]=Zn(sr);return or(n,{type:"Symbol",tag:e,description:t}),v||(n.description=t),n},Tr=function(e,t,n){e===ar&&Tr(gr,t,n),je(e);var r=Ie(t);return je(n),fe(mr,r)?(n.enumerable?(fe(e,nr)&&e[nr][r]&&(e[nr][r]=!1),n=Zn(n,{enumerable:_(0,!1)})):(fe(e,nr)||hr(e,nr,_(1,{})),e[nr][r]=!0),kr(e,r,n)):hr(e,r,n)},Or=function(e,t){je(e);var n=P(t),r=Fn(n).concat(Rr(n));return tr(r,(function(t){v&&!g(Er,n,t)||Tr(e,t,n[t]);})),e},Er=function(e){var t=Ie(e),n=g(yr,this,t);return !(this===ar&&fe(mr,t)&&!fe(gr,t))&&(!(n||!fe(this,t)||!fe(mr,t)||fe(this,nr)&&this[nr][t])||n)},xr=function(e,t){var n=P(e),r=Ie(t);if(n!==ar||!fe(mr,r)||fe(gr,r)){var o=dr(n,r);return !o||!fe(mr,r)||fe(n,nr)&&n[nr][r]||(o.enumerable=!0),o}},Cr=function(e){var t=pr(P(e)),n=[];return tr(t,(function(e){fe(mr,e)||fe(Be,e)||vr(n,e);})),n},Rr=function(e){var t=e===ar,n=pr(t?gr:P(e)),r=[];return tr(n,(function(e){!fe(mr,e)||t&&!fe(ar,e)||vr(r,mr[e]);})),r};if(G||(sr=(cr=function(){if(N(sr,this))throw ur("Symbol is not a constructor");var e=arguments.length&&void 0!==arguments[0]?zt(arguments[0]):void 0,t=ye(e),n=function(e){this===ar&&g(n,gr,e),fe(this,nr)&&fe(this[nr],t)&&(this[nr][t]=!1),kr(this,t,_(1,e));};return v&&_r&&kr(ar,t,{configurable:!0,set:n}),Ir(t,e)}).prototype,at(sr,"toString",(function(){return ir(this).tag})),at(cr,"withoutSetter",(function(e){return Ir(ye(e),e)})),S.f=Er,Pe.f=Tr,Re.f=xr,_t.f=Dn.f=Cr,kt.f=Rr,zn.f=function(e){return Ir(we(e),e)},v&&(hr(sr,"description",{configurable:!0,get:function(){return ir(this).description}}),at(ar,"propertyIsEnumerable",Er,{unsafe:!0}))),Kt({global:!0,wrap:!0,forced:!G,sham:!G},{Symbol:cr}),tr(Fn(Sr),(function(e){Bn(e);})),Kt({target:"Symbol",stat:!0,forced:!G},{for:function(e){var t=zt(e);if(fe(br,t))return br[t];var n=cr(t);return br[t]=n,wr[n]=t,n},keyFor:function(e){if(!q(e))throw ur(e+" is not a symbol");if(fe(wr,e))return wr[e]},useSetter:function(){_r=!0;},useSimple:function(){_r=!1;}}),Kt({target:"Object",stat:!0,forced:!G,sham:!v},{create:function(e,t){return void 0===t?Zn(e):Or(Zn(e),t)},defineProperty:Tr,defineProperties:Or,getOwnPropertyDescriptor:xr}),Kt({target:"Object",stat:!0,forced:!G},{getOwnPropertyNames:Cr,getOwnPropertySymbols:Rr}),Kt({target:"Object",stat:!0,forced:y((function(){kt.f(1);}))},{getOwnPropertySymbols:function(e){return kt.f(ue(e))}}),fr){var Fr=!G||y((function(){var e=cr();return "[null]"!=fr([e])||"{}"!=fr({a:e})||"{}"!=fr(Object(e))}));Kt({target:"JSON",stat:!0,forced:Fr},{stringify:function(e,t,n){var r=Vn(arguments),o=t;if((W(t)||void 0!==e)&&!q(e))return on(t)||(t=function(e,t){if(L(o)&&(t=g(o,this,e,t)),!q(t))return t}),r[1]=t,Rn(fr,null,r)}});}if(!sr[rr]){var Ar=sr.valueOf;at(sr,rr,(function(e){return g(Ar,this)}));}Hn(cr,"Symbol"),Be[nr]=!0,Bn("asyncIterator");var jr=Pe.f,Ur=p.Symbol,Kr=Ur&&Ur.prototype;if(v&&L(Ur)&&(!("description"in Kr)||void 0!==Ur().description)){var Pr={},Lr=function(){var e=arguments.length<1||void 0===arguments[0]?void 0:zt(arguments[0]),t=N(Kr,this)?new Ur(e):void 0===e?Ur():Ur(e);return ""===e&&(Pr[t]=!0),t};Ot(Lr,Ur),Lr.prototype=Kr,Kr.constructor=Lr;var Wr="Symbol(test)"==String(Ur("test")),Zr=E(Kr.toString),Vr=E(Kr.valueOf),Nr=/^Symbol\((.*)\)[^)]+$/,Xr=E("".replace),Dr=E("".slice);jr(Kr,"description",{configurable:!0,get:function(){var e=Vr(this),t=Zr(e);if(fe(Pr,e))return "";var n=Wr?Dr(t,7,-1):Xr(t,Nr,"$1");return ""===n?void 0:n}}),Kt({global:!0,forced:!0},{Symbol:Lr});}Bn("hasInstance"),Bn("isConcatSpreadable"),Bn("iterator"),Bn("match"),Bn("matchAll"),Bn("replace"),Bn("search"),Bn("species"),Bn("split"),Bn("toPrimitive"),Bn("toStringTag"),Bn("unscopables"),Hn(p.JSON,"JSON",!0),Hn(Math,"Math",!0),Kt({global:!0},{Reflect:{}}),Hn(p.Reflect,"Reflect",!0),Yn.Symbol;var zr,Yr,Jr,Br=E("".charAt),Gr=E("".charCodeAt),Mr=E("".slice),Hr=function(e){return function(t,n){var r,o,i=zt(K(t)),a=ut(n),c=i.length;return a<0||a>=c?e?"":void 0:(r=Gr(i,a))<55296||r>56319||a+1===c||(o=Gr(i,a+1))<56320||o>57343?e?Br(i,a):r:e?Mr(i,a,a+2):o-56320+(r-55296<<10)+65536}},qr={codeAt:Hr(!1),charAt:Hr(!0)},Qr=!y((function(){function e(){}return e.prototype.constructor=null,Object.getPrototypeOf(new e)!==e.prototype})),$r=Je("IE_PROTO"),eo=p.Object,to=eo.prototype,no=Qr?eo.getPrototypeOf:function(e){var t=ue(e);if(fe(t,$r))return t[$r];var n=t.constructor;return L(n)&&t instanceof n?n.prototype:t instanceof eo?to:null},ro=we("iterator"),oo=!1;[].keys&&("next"in(Jr=[].keys())?(Yr=no(no(Jr)))!==Object.prototype&&(zr=Yr):oo=!0),(null==zr||y((function(){var e={};return zr[ro].call(e)!==e})))&&(zr={}),L(zr[ro])||at(zr,ro,(function(){return this}));var io={IteratorPrototype:zr,BUGGY_SAFARI_ITERATORS:oo},ao={},co=io.IteratorPrototype,so=function(){return this},uo=p.String,lo=p.TypeError,fo=Object.setPrototypeOf||("__proto__"in{}?function(){var e,t=!1,n={};try{(e=E(Object.getOwnPropertyDescriptor(Object.prototype,"__proto__").set))(n,[]),t=n instanceof Array;}catch(e){}return function(n,r){return je(n),function(e){if("object"==typeof e||L(e))return e;throw lo("Can't set "+uo(e)+" as a prototype")}(r),t?e(n,r):n.__proto__=r,n}}():void 0),ho=it.PROPER,po=it.CONFIGURABLE,yo=io.IteratorPrototype,vo=io.BUGGY_SAFARI_ITERATORS,mo=we("iterator"),go=function(){return this},bo=function(e,t,n,r,o,i,a){!function(e,t,n){var r=t+" Iterator";e.prototype=Zn(co,{next:_(1,n)}),Hn(e,r,!1),ao[r]=so;}(n,t,r);var c,s,u,l=function(e){if(e===o&&y)return y;if(!vo&&e in h)return h[e];switch(e){case"keys":case"values":case"entries":return function(){return new n(this,e)}}return function(){return new n(this)}},f=t+" Iterator",d=!1,h=e.prototype,p=h[mo]||h["@@iterator"]||o&&h[o],y=!vo&&p||l(o),v="Array"==t&&h.entries||p;if(v&&(c=no(v.call(new e)))!==Object.prototype&&c.next&&(no(c)!==yo&&(fo?fo(c,yo):L(c[mo])||at(c,mo,go)),Hn(c,f,!0)),ho&&"values"==o&&p&&"values"!==p.name&&(po?Le(h,"name","values"):(d=!0,y=function(){return g(p,this)})),o)if(s={values:l("values"),keys:i?y:l("keys"),entries:l("entries")},a)for(u in s)(vo||d||!(u in h))&&at(h,u,s[u]);else Kt({target:t,proto:!0,forced:vo||d},s);return h[mo]!==y&&at(h,mo,y,{name:o}),ao[t]=y,s},wo=qr.charAt,So=tt.set,_o=tt.getterFor("String Iterator");bo(String,"String",(function(e){So(this,{type:"String Iterator",string:zt(e),index:0});}),(function(){var e,t=_o(this),n=t.string,r=t.index;return r>=n.length?{value:void 0,done:!0}:(e=wo(n,r),t.index+=e.length,{value:e,done:!1})}));var ko=function(e,t,n){var r,o;je(e);try{if(!(r=ne(e,"return"))){if("throw"===t)throw n;return n}r=g(r,e);}catch(e){o=!0,r=e;}if("throw"===t)throw n;if(o)throw r;return je(r),n},Io=function(e,t,n,r){try{return r?t(je(n)[0],n[1]):t(n)}catch(t){ko(e,"throw",t);}},To=we("iterator"),Oo=Array.prototype,Eo=function(e){return void 0!==e&&(ao.Array===e||Oo[To]===e)},xo=we("iterator"),Co=function(e){if(null!=e)return ne(e,xo)||ne(e,"@@iterator")||ao[Xt(e)]},Ro=p.TypeError,Fo=function(e,t){var n=arguments.length<2?Co(e):t;if(te(n))return je(g(n,e));throw Ro($(e)+" is not iterable")},Ao=p.Array,jo=we("iterator"),Uo=!1;try{var Ko=0,Po={next:function(){return {done:!!Ko++}},return:function(){Uo=!0;}};Po[jo]=function(){return this},Array.from(Po,(function(){throw 2}));}catch(e){}var Lo=function(e,t){if(!t&&!Uo)return !1;var n=!1;try{var r={};r[jo]=function(){return {next:function(){return {done:n=!0}}}},e(r);}catch(e){}return n},Wo=!Lo((function(e){Array.from(e);}));Kt({target:"Array",stat:!0,forced:Wo},{from:function(e){var t=ue(e),n=pn(this),r=arguments.length,o=r>1?arguments[1]:void 0,i=void 0!==o;i&&(o=Qn(o,r>2?arguments[2]:void 0));var a,c,s,u,l,f,d=Co(t),h=0;if(!d||this==Ao&&Eo(d))for(a=pt(t),c=n?new this(a):Ao(a);a>h;h++)f=i?o(t[h],h):t[h],an(c,h,f);else for(l=(u=Fo(t,d)).next,c=n?new this:[];!(s=g(l,u)).done;h++)f=i?Io(u,o,[s.value,h],!0):s.value,an(c,h,f);return c.length=h,c}}),Yn.Array.from;var Zo,Vo,No,Xo="undefined"!=typeof ArrayBuffer&&"undefined"!=typeof DataView,Do=Pe.f,zo=p.Int8Array,Yo=zo&&zo.prototype,Jo=p.Uint8ClampedArray,Bo=Jo&&Jo.prototype,Go=zo&&no(zo),Mo=Yo&&no(Yo),Ho=Object.prototype,qo=p.TypeError,Qo=we("toStringTag"),$o=ye("TYPED_ARRAY_TAG"),ei=ye("TYPED_ARRAY_CONSTRUCTOR"),ti=Xo&&!!fo&&"Opera"!==Xt(p.opera),ni=!1,ri={Int8Array:1,Uint8Array:1,Uint8ClampedArray:1,Int16Array:2,Uint16Array:2,Int32Array:4,Uint32Array:4,Float32Array:4,Float64Array:8},oi={BigInt64Array:8,BigUint64Array:8},ii=function(e){if(!W(e))return !1;var t=Xt(e);return fe(ri,t)||fe(oi,t)};for(Zo in ri)(No=(Vo=p[Zo])&&Vo.prototype)?Le(No,ei,Vo):ti=!1;for(Zo in oi)(No=(Vo=p[Zo])&&Vo.prototype)&&Le(No,ei,Vo);if((!ti||!L(Go)||Go===Function.prototype)&&(Go=function(){throw qo("Incorrect invocation")},ti))for(Zo in ri)p[Zo]&&fo(p[Zo],Go);if((!ti||!Mo||Mo===Ho)&&(Mo=Go.prototype,ti))for(Zo in ri)p[Zo]&&fo(p[Zo].prototype,Mo);if(ti&&no(Bo)!==Mo&&fo(Bo,Mo),v&&!fe(Mo,Qo))for(Zo in ni=!0,Do(Mo,Qo,{get:function(){return W(this)?this[$o]:void 0}}),ri)p[Zo]&&Le(p[Zo],$o,Zo);var ai={NATIVE_ARRAY_BUFFER_VIEWS:ti,TYPED_ARRAY_CONSTRUCTOR:ei,TYPED_ARRAY_TAG:ni&&$o,aTypedArray:function(e){if(ii(e))return e;throw qo("Target is not a typed array")},aTypedArrayConstructor:function(e){if(L(e)&&(!fo||N(Go,e)))return e;throw qo($(e)+" is not a typed array constructor")},exportTypedArrayMethod:function(e,t,n){if(v){if(n)for(var r in ri){var o=p[r];if(o&&fe(o.prototype,e))try{delete o.prototype[e];}catch(e){}}Mo[e]&&!n||at(Mo,e,n?t:ti&&Yo[e]||t);}},exportTypedArrayStaticMethod:function(e,t,n){var r,o;if(v){if(fo){if(n)for(r in ri)if((o=p[r])&&fe(o,e))try{delete o[e];}catch(e){}if(Go[e]&&!n)return;try{return at(Go,e,n?t:ti&&Go[e]||t)}catch(e){}}for(r in ri)!(o=p[r])||o[e]&&!n||at(o,e,t);}},isView:function(e){if(!W(e))return !1;var t=Xt(e);return "DataView"===t||fe(ri,t)||fe(oi,t)},isTypedArray:ii,TypedArray:Go,TypedArrayPrototype:Mo},ci=p.TypeError,si=we("species"),ui=function(e,t){var n,r=je(e).constructor;return void 0===r||null==(n=je(r)[si])?t:function(e){if(pn(e))return e;throw ci($(e)+" is not a constructor")}(n)},li=ai.TYPED_ARRAY_CONSTRUCTOR,fi=ai.aTypedArrayConstructor,di=ai.aTypedArray;(0, ai.exportTypedArrayMethod)("slice",(function(e,t){for(var n,r=Vn(di(this),e,t),o=fi(ui(n=this,n[li])),i=0,a=r.length,c=new o(a);a>i;)c[i]=r[i++];return c}),y((function(){new Int8Array(1).slice();})));var hi=we("unscopables"),pi=Array.prototype;null==pi[hi]&&Pe.f(pi,hi,{configurable:!0,value:Zn(null)});var yi=function(e){pi[hi][e]=!0;},vi=vt.includes;Kt({target:"Array",proto:!0},{includes:function(e){return vi(this,e,arguments.length>1?arguments[1]:void 0)}}),yi("includes"),nn("Array","includes");var mi=E("".indexOf);Kt({target:"String",proto:!0,forced:!Mt("includes")},{includes:function(e){return !!~mi(zt(K(this)),zt(Bt(e)),arguments.length>1?arguments[1]:void 0)}}),nn("String","includes");var gi=tt.set,bi=tt.getterFor("Array Iterator");bo(Array,"Array",(function(e,t){gi(this,{type:"Array Iterator",target:P(e),index:0,kind:t});}),(function(){var e=bi(this),t=e.target,n=e.kind,r=e.index++;return !t||r>=t.length?(e.target=void 0,{value:void 0,done:!0}):"keys"==n?{value:r,done:!1}:"values"==n?{value:t[r],done:!1}:{value:[r,t[r]],done:!1}}),"values"),ao.Arguments=ao.Array,yi("keys"),yi("values"),yi("entries");var wi=y((function(){if("function"==typeof ArrayBuffer){var e=new ArrayBuffer(8);Object.isExtensible(e)&&Object.defineProperty(e,"a",{value:8});}})),Si=Object.isExtensible,_i=y((function(){Si(1);}))||wi?function(e){return !!W(e)&&((!wi||"ArrayBuffer"!=R(e))&&(!Si||Si(e)))}:Si,ki=!y((function(){return Object.isExtensible(Object.preventExtensions({}))})),Ii=l((function(e){var t=Pe.f,n=!1,r=ye("meta"),o=0,i=function(e){t(e,r,{value:{objectID:"O"+o++,weakData:{}}});},a=e.exports={enable:function(){a.enable=function(){},n=!0;var e=_t.f,t=E([].splice),o={};o[r]=1,e(o).length&&(_t.f=function(n){for(var o=e(n),i=0,a=o.length;i<a;i++)if(o[i]===r){t(o,i,1);break}return o},Kt({target:"Object",stat:!0,forced:!0},{getOwnPropertyNames:Dn.f}));},fastKey:function(e,t){if(!W(e))return "symbol"==typeof e?e:("string"==typeof e?"S":"P")+e;if(!fe(e,r)){if(!_i(e))return "F";if(!t)return "E";i(e);}return e[r].objectID},getWeakData:function(e,t){if(!fe(e,r)){if(!_i(e))return !0;if(!t)return !1;i(e);}return e[r].weakData},onFreeze:function(e){return ki&&n&&_i(e)&&!fe(e,r)&&i(e),e}};Be[r]=!0;}));Ii.enable,Ii.fastKey,Ii.getWeakData,Ii.onFreeze;var Ti=p.TypeError,Oi=function(e,t){this.stopped=e,this.result=t;},Ei=Oi.prototype,xi=function(e,t,n){var r,o,i,a,c,s,u,l=n&&n.that,f=!(!n||!n.AS_ENTRIES),d=!(!n||!n.IS_ITERATOR),h=!(!n||!n.INTERRUPTED),p=Qn(t,l),y=function(e){return r&&ko(r,"normal",e),new Oi(!0,e)},v=function(e){return f?(je(e),h?p(e[0],e[1],y):p(e[0],e[1])):h?p(e,y):p(e)};if(d)r=e;else {if(!(o=Co(e)))throw Ti($(e)+" is not iterable");if(Eo(o)){for(i=0,a=pt(e);a>i;i++)if((c=v(e[i]))&&N(Ei,c))return c;return new Oi(!1)}r=Fo(e,o);}for(s=r.next;!(u=g(s,r)).done;){try{c=v(u.value);}catch(e){ko(r,"throw",e);}if("object"==typeof c&&c&&N(Ei,c))return c}return new Oi(!1)},Ci=p.TypeError,Ri=function(e,t){if(N(t,e))return e;throw Ci("Incorrect invocation")},Fi=function(e,t,n){for(var r in t)at(e,r,t[r],n);return e},Ai=we("species"),ji=Pe.f,Ui=Ii.fastKey,Ki=tt.set,Pi=tt.getterFor,Li={getConstructor:function(e,t,n,r){var o=e((function(e,o){Ri(e,i),Ki(e,{type:t,index:Zn(null),first:void 0,last:void 0,size:0}),v||(e.size=0),null!=o&&xi(o,e[r],{that:e,AS_ENTRIES:n});})),i=o.prototype,a=Pi(t),c=function(e,t,n){var r,o,i=a(e),c=s(e,t);return c?c.value=n:(i.last=c={index:o=Ui(t,!0),key:t,value:n,previous:r=i.last,next:void 0,removed:!1},i.first||(i.first=c),r&&(r.next=c),v?i.size++:e.size++,"F"!==o&&(i.index[o]=c)),e},s=function(e,t){var n,r=a(e),o=Ui(t);if("F"!==o)return r.index[o];for(n=r.first;n;n=n.next)if(n.key==t)return n};return Fi(i,{clear:function(){for(var e=a(this),t=e.index,n=e.first;n;)n.removed=!0,n.previous&&(n.previous=n.previous.next=void 0),delete t[n.index],n=n.next;e.first=e.last=void 0,v?e.size=0:this.size=0;},delete:function(e){var t=this,n=a(t),r=s(t,e);if(r){var o=r.next,i=r.previous;delete n.index[r.index],r.removed=!0,i&&(i.next=o),o&&(o.previous=i),n.first==r&&(n.first=o),n.last==r&&(n.last=i),v?n.size--:t.size--;}return !!r},forEach:function(e){for(var t,n=a(this),r=Qn(e,arguments.length>1?arguments[1]:void 0);t=t?t.next:n.first;)for(r(t.value,t.key,this);t&&t.removed;)t=t.previous;},has:function(e){return !!s(this,e)}}),Fi(i,n?{get:function(e){var t=s(this,e);return t&&t.value},set:function(e,t){return c(this,0===e?0:e,t)}}:{add:function(e){return c(this,e=0===e?0:e,e)}}),v&&ji(i,"size",{get:function(){return a(this).size}}),o},setStrong:function(e,t,n){var r=t+" Iterator",o=Pi(t),i=Pi(r);bo(e,t,(function(e,t){Ki(this,{type:r,target:e,state:o(e),kind:t,last:void 0});}),(function(){for(var e=i(this),t=e.kind,n=e.last;n&&n.removed;)n=n.previous;return e.target&&(e.last=n=n?n.next:e.state.first)?"keys"==t?{value:n.key,done:!1}:"values"==t?{value:n.value,done:!1}:{value:[n.key,n.value],done:!1}:(e.target=void 0,{value:void 0,done:!0})}),n?"entries":"values",!n,!0),function(e){var t=V(e),n=Pe.f;v&&t&&!t[Ai]&&n(t,Ai,{configurable:!0,get:function(){return this}});}(t);}};function Wi(e){var t=this.constructor;return this.then((function(n){return t.resolve(e()).then((function(){return n}))}),(function(n){return t.resolve(e()).then((function(){return t.reject(n)}))}))}function Zi(e){return new this((function(t,n){if(!e||void 0===e.length)return n(new TypeError(typeof e+" "+e+" is not iterable(cannot read property Symbol(Symbol.iterator))"));var r=Array.prototype.slice.call(e);if(0===r.length)return t([]);var o=r.length;function i(e,n){if(n&&("object"==typeof n||"function"==typeof n)){var a=n.then;if("function"==typeof a)return void a.call(n,(function(t){i(e,t);}),(function(n){r[e]={status:"rejected",reason:n},0==--o&&t(r);}))}r[e]={status:"fulfilled",value:n},0==--o&&t(r);}for(var a=0;a<r.length;a++)i(a,r[a]);}))}!function(e,t,n){var r=-1!==e.indexOf("Map"),o=-1!==e.indexOf("Weak"),i=r?"set":"add",a=p[e],c=a&&a.prototype,s=a,u={},l=function(e){var t=E(c[e]);at(c,e,"add"==e?function(e){return t(this,0===e?0:e),this}:"delete"==e?function(e){return !(o&&!W(e))&&t(this,0===e?0:e)}:"get"==e?function(e){return o&&!W(e)?void 0:t(this,0===e?0:e)}:"has"==e?function(e){return !(o&&!W(e))&&t(this,0===e?0:e)}:function(e,n){return t(this,0===e?0:e,n),this});};if(jt(e,!L(a)||!(o||c.forEach&&!y((function(){(new a).entries().next();})))))s=n.getConstructor(t,e,r,i),Ii.enable();else if(jt(e,!0)){var f=new s,d=f[i](o?{}:-0,1)!=f,h=y((function(){f.has(1);})),v=Lo((function(e){new a(e);})),m=!o&&y((function(){for(var e=new a,t=5;t--;)e[i](t,t);return !e.has(-0)}));v||((s=t((function(e,t){Ri(e,c);var n=function(e,t,n){var r,o;return fo&&L(r=t.constructor)&&r!==n&&W(o=r.prototype)&&o!==n.prototype&&fo(e,o),e}(new a,e,s);return null!=t&&xi(t,n[i],{that:n,AS_ENTRIES:r}),n}))).prototype=c,c.constructor=s),(h||m)&&(l("delete"),l("has"),r&&l("get")),(m||d)&&l(i),o&&c.clear&&delete c.clear;}u[e]=s,Kt({global:!0,forced:s!=a},u),Hn(s,e),o||n.setStrong(s,e,r);}("Set",(function(e){return function(){return e(this,arguments.length?arguments[0]:void 0)}}),Li),Yn.Set;var Vi=setTimeout,Ni="undefined"!=typeof setImmediate?setImmediate:null;function Xi(e){return Boolean(e&&void 0!==e.length)}function Di(){}function zi(e){if(!(this instanceof zi))throw new TypeError("Promises must be constructed via new");if("function"!=typeof e)throw new TypeError("not a function");this._state=0,this._handled=!1,this._value=void 0,this._deferreds=[],Hi(e,this);}function Yi(e,t){for(;3===e._state;)e=e._value;0!==e._state?(e._handled=!0,zi._immediateFn((function(){var n=1===e._state?t.onFulfilled:t.onRejected;if(null!==n){var r;try{r=n(e._value);}catch(e){return void Bi(t.promise,e)}Ji(t.promise,r);}else (1===e._state?Ji:Bi)(t.promise,e._value);}))):e._deferreds.push(t);}function Ji(e,t){try{if(t===e)throw new TypeError("A promise cannot be resolved with itself.");if(t&&("object"==typeof t||"function"==typeof t)){var n=t.then;if(t instanceof zi)return e._state=3,e._value=t,void Gi(e);if("function"==typeof n)return void Hi((r=n,o=t,function(){r.apply(o,arguments);}),e)}e._state=1,e._value=t,Gi(e);}catch(t){Bi(e,t);}var r,o;}function Bi(e,t){e._state=2,e._value=t,Gi(e);}function Gi(e){2===e._state&&0===e._deferreds.length&&zi._immediateFn((function(){e._handled||zi._unhandledRejectionFn(e._value);}));for(var t=0,n=e._deferreds.length;t<n;t++)Yi(e,e._deferreds[t]);e._deferreds=null;}function Mi(e,t,n){this.onFulfilled="function"==typeof e?e:null,this.onRejected="function"==typeof t?t:null,this.promise=n;}function Hi(e,t){var n=!1;try{e((function(e){n||(n=!0,Ji(t,e));}),(function(e){n||(n=!0,Bi(t,e));}));}catch(e){if(n)return;n=!0,Bi(t,e);}}zi.prototype.catch=function(e){return this.then(null,e)},zi.prototype.then=function(e,t){var n=new this.constructor(Di);return Yi(this,new Mi(e,t,n)),n},zi.prototype.finally=Wi,zi.all=function(e){return new zi((function(t,n){if(!Xi(e))return n(new TypeError("Promise.all accepts an array"));var r=Array.prototype.slice.call(e);if(0===r.length)return t([]);var o=r.length;function i(e,a){try{if(a&&("object"==typeof a||"function"==typeof a)){var c=a.then;if("function"==typeof c)return void c.call(a,(function(t){i(e,t);}),n)}r[e]=a,0==--o&&t(r);}catch(e){n(e);}}for(var a=0;a<r.length;a++)i(a,r[a]);}))},zi.allSettled=Zi,zi.resolve=function(e){return e&&"object"==typeof e&&e.constructor===zi?e:new zi((function(t){t(e);}))},zi.reject=function(e){return new zi((function(t,n){n(e);}))},zi.race=function(e){return new zi((function(t,n){if(!Xi(e))return n(new TypeError("Promise.race accepts an array"));for(var r=0,o=e.length;r<o;r++)zi.resolve(e[r]).then(t,n);}))},zi._immediateFn="function"==typeof Ni&&function(e){Ni(e);}||function(e){Vi(e,0);},zi._unhandledRejectionFn=function(e){"undefined"!=typeof console&&console&&console.warn("Possible Unhandled Promise Rejection:",e);};var qi=function(){if("undefined"!=typeof self)return self;if("undefined"!=typeof window)return window;if("undefined"!=typeof global)return global;throw new Error("unable to locate global object")}();"function"!=typeof qi.Promise?qi.Promise=zi:(qi.Promise.prototype.finally||(qi.Promise.prototype.finally=Wi),qi.Promise.allSettled||(qi.Promise.allSettled=Zi)),function(e){function t(){}function n(e,t){if(e=void 0===e?"utf-8":e,t=void 0===t?{fatal:!1}:t,-1===o.indexOf(e.toLowerCase()))throw new RangeError("Failed to construct 'TextDecoder': The encoding label provided ('"+e+"') is invalid.");if(t.fatal)throw Error("Failed to construct 'TextDecoder': the 'fatal' option is unsupported.")}function r(e){for(var t=0,n=Math.min(65536,e.length+1),r=new Uint16Array(n),o=[],i=0;;){var a=t<e.length;if(!a||i>=n-1){if(o.push(String.fromCharCode.apply(null,r.subarray(0,i))),!a)return o.join("");e=e.subarray(t),i=t=0;}if(0==(128&(a=e[t++])))r[i++]=a;else if(192==(224&a)){var c=63&e[t++];r[i++]=(31&a)<<6|c;}else if(224==(240&a)){c=63&e[t++];var s=63&e[t++];r[i++]=(31&a)<<12|c<<6|s;}else if(240==(248&a)){65535<(a=(7&a)<<18|(c=63&e[t++])<<12|(s=63&e[t++])<<6|63&e[t++])&&(a-=65536,r[i++]=a>>>10&1023|55296,a=56320|1023&a),r[i++]=a;}}}if(e.TextEncoder&&e.TextDecoder)return !1;var o=["utf-8","utf8","unicode-1-1-utf-8"];Object.defineProperty(t.prototype,"encoding",{value:"utf-8"}),t.prototype.encode=function(e,t){if((t=void 0===t?{stream:!1}:t).stream)throw Error("Failed to encode: the 'stream' option is unsupported.");t=0;for(var n=e.length,r=0,o=Math.max(32,n+(n>>>1)+7),i=new Uint8Array(o>>>3<<3);t<n;){var a=e.charCodeAt(t++);if(55296<=a&&56319>=a){if(t<n){var c=e.charCodeAt(t);56320==(64512&c)&&(++t,a=((1023&a)<<10)+(1023&c)+65536);}if(55296<=a&&56319>=a)continue}if(r+4>i.length&&(o+=8,o=(o*=1+t/e.length*2)>>>3<<3,(c=new Uint8Array(o)).set(i),i=c),0==(4294967168&a))i[r++]=a;else {if(0==(4294965248&a))i[r++]=a>>>6&31|192;else if(0==(4294901760&a))i[r++]=a>>>12&15|224,i[r++]=a>>>6&63|128;else {if(0!=(4292870144&a))continue;i[r++]=a>>>18&7|240,i[r++]=a>>>12&63|128,i[r++]=a>>>6&63|128;}i[r++]=63&a|128;}}return i.slice?i.slice(0,r):i.subarray(0,r)},Object.defineProperty(n.prototype,"encoding",{value:"utf-8"}),Object.defineProperty(n.prototype,"fatal",{value:!1}),Object.defineProperty(n.prototype,"ignoreBOM",{value:!1});var i=r;"function"==typeof Buffer&&Buffer.from?i=function(e){return Buffer.from(e.buffer,e.byteOffset,e.byteLength).toString("utf-8")}:"function"==typeof Blob&&"function"==typeof URL&&"function"==typeof URL.createObjectURL&&(i=function(e){var t=URL.createObjectURL(new Blob([e],{type:"text/plain;charset=UTF-8"}));try{var n=new XMLHttpRequest;return n.open("GET",t,!1),n.send(),n.responseText}catch(t){return r(e)}finally{URL.revokeObjectURL(t);}}),n.prototype.decode=function(e,t){if((t=void 0===t?{stream:!1}:t).stream)throw Error("Failed to decode: the 'stream' option is unsupported.");return e=e instanceof Uint8Array?e:e.buffer instanceof ArrayBuffer?new Uint8Array(e.buffer):new Uint8Array(e),i(e)},e.TextEncoder=t,e.TextDecoder=n;}("undefined"!=typeof window?window:s),function(){function e(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function t(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r);}}function n(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}function r(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&i(e,t);}function o(e){return (o=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function i(e,t){return (i=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function a(){if("undefined"==typeof Reflect||!Reflect.construct)return !1;if(Reflect.construct.sham)return !1;if("function"==typeof Proxy)return !0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return !1}}function c(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function u(e,t){return !t||"object"!=typeof t&&"function"!=typeof t?c(e):t}function l(e){var t=a();return function(){var n,r=o(e);if(t){var i=o(this).constructor;n=Reflect.construct(r,arguments,i);}else n=r.apply(this,arguments);return u(this,n)}}function f(e,t){for(;!Object.prototype.hasOwnProperty.call(e,t)&&null!==(e=o(e)););return e}function d(e,t,n){return (d="undefined"!=typeof Reflect&&Reflect.get?Reflect.get:function(e,t,n){var r=f(e,t);if(r){var o=Object.getOwnPropertyDescriptor(r,t);return o.get?o.get.call(n):o.value}})(e,t,n||e)}var h=function(){function t(){e(this,t),Object.defineProperty(this,"listeners",{value:{},writable:!0,configurable:!0});}return n(t,[{key:"addEventListener",value:function(e,t,n){e in this.listeners||(this.listeners[e]=[]),this.listeners[e].push({callback:t,options:n});}},{key:"removeEventListener",value:function(e,t){if(e in this.listeners)for(var n=this.listeners[e],r=0,o=n.length;r<o;r++)if(n[r].callback===t)return void n.splice(r,1)}},{key:"dispatchEvent",value:function(e){if(e.type in this.listeners){for(var t=this.listeners[e.type].slice(),n=0,r=t.length;n<r;n++){var o=t[n];try{o.callback.call(this,e);}catch(e){Promise.resolve().then((function(){throw e}));}o.options&&o.options.once&&this.removeEventListener(e.type,o.callback);}return !e.defaultPrevented}}}]),t}(),p=function(t){r(a,t);var i=l(a);function a(){var t;return e(this,a),(t=i.call(this)).listeners||h.call(c(t)),Object.defineProperty(c(t),"aborted",{value:!1,writable:!0,configurable:!0}),Object.defineProperty(c(t),"onabort",{value:null,writable:!0,configurable:!0}),t}return n(a,[{key:"toString",value:function(){return "[object AbortSignal]"}},{key:"dispatchEvent",value:function(e){"abort"===e.type&&(this.aborted=!0,"function"==typeof this.onabort&&this.onabort.call(this,e)),d(o(a.prototype),"dispatchEvent",this).call(this,e);}}]),a}(h),y=function(){function t(){e(this,t),Object.defineProperty(this,"signal",{value:new p,writable:!0,configurable:!0});}return n(t,[{key:"abort",value:function(){var e;try{e=new Event("abort");}catch(t){"undefined"!=typeof document?document.createEvent?(e=document.createEvent("Event")).initEvent("abort",!1,!1):(e=document.createEventObject()).type="abort":e={type:"abort",bubbles:!1,cancelable:!1};}this.signal.dispatchEvent(e);}},{key:"toString",value:function(){return "[object AbortController]"}}]),t}();function v(e){return e.__FORCE_INSTALL_ABORTCONTROLLER_POLYFILL?(console.log("__FORCE_INSTALL_ABORTCONTROLLER_POLYFILL=true is set, will force install polyfill"),!0):"function"==typeof e.Request&&!e.Request.prototype.hasOwnProperty("signal")||!e.AbortController}"undefined"!=typeof Symbol&&Symbol.toStringTag&&(y.prototype[Symbol.toStringTag]="AbortController",p.prototype[Symbol.toStringTag]="AbortSignal"),function(e){v(e)&&(e.AbortController=y,e.AbortSignal=p);}("undefined"!=typeof self?self:s);}();var Qi=l((function(e,t){Object.defineProperty(t,"__esModule",{value:!0});var n=function(){function e(){var e=this;this.locked=new Map,this.addToLocked=function(t,n){var r=e.locked.get(t);void 0===r?void 0===n?e.locked.set(t,[]):e.locked.set(t,[n]):void 0!==n&&(r.unshift(n),e.locked.set(t,r));},this.isLocked=function(t){return e.locked.has(t)},this.lock=function(t){return new Promise((function(n,r){e.isLocked(t)?e.addToLocked(t,n):(e.addToLocked(t),n());}))},this.unlock=function(t){var n=e.locked.get(t);if(void 0!==n&&0!==n.length){var r=n.pop();e.locked.set(t,n),void 0!==r&&setTimeout(r,0);}else e.locked.delete(t);};}return e.getInstance=function(){return void 0===e.instance&&(e.instance=new e),e.instance},e}();t.default=function(){return n.getInstance()};}));u(Qi);var $i=u(l((function(e,t){var n=s&&s.__awaiter||function(e,t,n,r){return new(n||(n=Promise))((function(o,i){function a(e){try{s(r.next(e));}catch(e){i(e);}}function c(e){try{s(r.throw(e));}catch(e){i(e);}}function s(e){e.done?o(e.value):new n((function(t){t(e.value);})).then(a,c);}s((r=r.apply(e,t||[])).next());}))},r=s&&s.__generator||function(e,t){var n,r,o,i,a={label:0,sent:function(){if(1&o[0])throw o[1];return o[1]},trys:[],ops:[]};return i={next:c(0),throw:c(1),return:c(2)},"function"==typeof Symbol&&(i[Symbol.iterator]=function(){return this}),i;function c(i){return function(c){return function(i){if(n)throw new TypeError("Generator is already executing.");for(;a;)try{if(n=1,r&&(o=2&i[0]?r.return:i[0]?r.throw||((o=r.return)&&o.call(r),0):r.next)&&!(o=o.call(r,i[1])).done)return o;switch(r=0,o&&(i=[2&i[0],o.value]),i[0]){case 0:case 1:o=i;break;case 4:return a.label++,{value:i[1],done:!1};case 5:a.label++,r=i[1],i=[0];continue;case 7:i=a.ops.pop(),a.trys.pop();continue;default:if(!(o=a.trys,(o=o.length>0&&o[o.length-1])||6!==i[0]&&2!==i[0])){a=0;continue}if(3===i[0]&&(!o||i[1]>o[0]&&i[1]<o[3])){a.label=i[1];break}if(6===i[0]&&a.label<o[1]){a.label=o[1],o=i;break}if(o&&a.label<o[2]){a.label=o[2],a.ops.push(i);break}o[2]&&a.ops.pop(),a.trys.pop();continue}i=t.call(e,a);}catch(e){i=[6,e],r=0;}finally{n=o=0;}if(5&i[0])throw i[1];return {value:i[0]?i[1]:void 0,done:!0}}([i,c])}}};Object.defineProperty(t,"__esModule",{value:!0});var o="browser-tabs-lock-key";function i(e){return new Promise((function(t){return setTimeout(t,e)}))}function a(e){for(var t="0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz",n="",r=0;r<e;r++){n+=t[Math.floor(Math.random()*t.length)];}return n}var c=function(){function e(){this.acquiredIatSet=new Set,this.id=Date.now().toString()+a(15),this.acquireLock=this.acquireLock.bind(this),this.releaseLock=this.releaseLock.bind(this),this.releaseLock__private__=this.releaseLock__private__.bind(this),this.waitForSomethingToChange=this.waitForSomethingToChange.bind(this),this.refreshLockWhileAcquired=this.refreshLockWhileAcquired.bind(this),void 0===e.waiters&&(e.waiters=[]);}return e.prototype.acquireLock=function(t,c){return void 0===c&&(c=5e3),n(this,void 0,void 0,(function(){var n,s,u,l,f,d;return r(this,(function(r){switch(r.label){case 0:n=Date.now()+a(4),s=Date.now()+c,u=o+"-"+t,l=window.localStorage,r.label=1;case 1:return Date.now()<s?[4,i(30)]:[3,8];case 2:return r.sent(),null!==l.getItem(u)?[3,5]:(f=this.id+"-"+t+"-"+n,[4,i(Math.floor(25*Math.random()))]);case 3:return r.sent(),l.setItem(u,JSON.stringify({id:this.id,iat:n,timeoutKey:f,timeAcquired:Date.now(),timeRefreshed:Date.now()})),[4,i(30)];case 4:return r.sent(),null!==(d=l.getItem(u))&&(d=JSON.parse(d)).id===this.id&&d.iat===n?(this.acquiredIatSet.add(n),this.refreshLockWhileAcquired(u,n),[2,!0]):[3,7];case 5:return e.lockCorrector(),[4,this.waitForSomethingToChange(s)];case 6:r.sent(),r.label=7;case 7:return n=Date.now()+a(4),[3,1];case 8:return [2,!1]}}))}))},e.prototype.refreshLockWhileAcquired=function(e,t){return n(this,void 0,void 0,(function(){var o=this;return r(this,(function(i){return setTimeout((function(){return n(o,void 0,void 0,(function(){var n,o;return r(this,(function(r){switch(r.label){case 0:return [4,Qi.default().lock(t)];case 1:return r.sent(),this.acquiredIatSet.has(t)?(n=window.localStorage,null===(o=n.getItem(e))?(Qi.default().unlock(t),[2]):((o=JSON.parse(o)).timeRefreshed=Date.now(),n.setItem(e,JSON.stringify(o)),Qi.default().unlock(t),this.refreshLockWhileAcquired(e,t),[2])):(Qi.default().unlock(t),[2])}}))}))}),1e3),[2]}))}))},e.prototype.waitForSomethingToChange=function(t){return n(this,void 0,void 0,(function(){return r(this,(function(n){switch(n.label){case 0:return [4,new Promise((function(n){var r=!1,o=Date.now(),i=!1;function a(){if(i||(window.removeEventListener("storage",a),e.removeFromWaiting(a),clearTimeout(c),i=!0),!r){r=!0;var t=50-(Date.now()-o);t>0?setTimeout(n,t):n();}}window.addEventListener("storage",a),e.addToWaiting(a);var c=setTimeout(a,Math.max(0,t-Date.now()));}))];case 1:return n.sent(),[2]}}))}))},e.addToWaiting=function(t){this.removeFromWaiting(t),void 0!==e.waiters&&e.waiters.push(t);},e.removeFromWaiting=function(t){void 0!==e.waiters&&(e.waiters=e.waiters.filter((function(e){return e!==t})));},e.notifyWaiters=function(){void 0!==e.waiters&&e.waiters.slice().forEach((function(e){return e()}));},e.prototype.releaseLock=function(e){return n(this,void 0,void 0,(function(){return r(this,(function(t){switch(t.label){case 0:return [4,this.releaseLock__private__(e)];case 1:return [2,t.sent()]}}))}))},e.prototype.releaseLock__private__=function(t){return n(this,void 0,void 0,(function(){var n,i,a;return r(this,(function(r){switch(r.label){case 0:return n=window.localStorage,i=o+"-"+t,null===(a=n.getItem(i))?[2]:(a=JSON.parse(a)).id!==this.id?[3,2]:[4,Qi.default().lock(a.iat)];case 1:r.sent(),this.acquiredIatSet.delete(a.iat),n.removeItem(i),Qi.default().unlock(a.iat),e.notifyWaiters(),r.label=2;case 2:return [2]}}))}))},e.lockCorrector=function(){for(var t=Date.now()-5e3,n=window.localStorage,r=Object.keys(n),i=!1,a=0;a<r.length;a++){var c=r[a];if(c.includes(o)){var s=n.getItem(c);null!==s&&(void 0===(s=JSON.parse(s)).timeRefreshed&&s.timeAcquired<t||void 0!==s.timeRefreshed&&s.timeRefreshed<t)&&(n.removeItem(c),i=!0);}}i&&e.notifyWaiters();},e.waiters=void 0,e}();t.default=c;}))),ea={timeoutInSeconds:60},ta=["login_required","consent_required","interaction_required","account_selection_required","access_denied"],na={name:"auth0-spa-js",version:"1.19.3"},ra=function(){return Date.now()},oa=function(e){function n(t,r){var o=e.call(this,r)||this;return o.error=t,o.error_description=r,Object.setPrototypeOf(o,n.prototype),o}return t(n,e),n.fromPayload=function(e){return new n(e.error,e.error_description)},n}(Error),ia=function(e){function n(t,r,o,i){void 0===i&&(i=null);var a=e.call(this,t,r)||this;return a.state=o,a.appState=i,Object.setPrototypeOf(a,n.prototype),a}return t(n,e),n}(oa),aa=function(e){function n(){var t=e.call(this,"timeout","Timeout")||this;return Object.setPrototypeOf(t,n.prototype),t}return t(n,e),n}(oa),ca=function(e){function n(t){var r=e.call(this)||this;return r.popup=t,Object.setPrototypeOf(r,n.prototype),r}return t(n,e),n}(aa),sa=function(e){function n(t){var r=e.call(this,"cancelled","Popup closed")||this;return r.popup=t,Object.setPrototypeOf(r,n.prototype),r}return t(n,e),n}(oa),ua=function(e){function n(t,r,o){var i=e.call(this,t,r)||this;return i.mfa_token=o,Object.setPrototypeOf(i,n.prototype),i}return t(n,e),n}(oa),la=function(e){return new Promise((function(t,n){var r,o=setInterval((function(){e.popup&&e.popup.closed&&(clearInterval(o),clearTimeout(i),window.removeEventListener("message",r,!1),n(new sa(e.popup)));}),1e3),i=setTimeout((function(){clearInterval(o),n(new ca(e.popup)),window.removeEventListener("message",r,!1);}),1e3*(e.timeoutInSeconds||60));r=function(a){if(a.data&&"authorization_response"===a.data.type){if(clearTimeout(i),clearInterval(o),window.removeEventListener("message",r,!1),e.popup.close(),a.data.response.error)return n(oa.fromPayload(a.data.response));t(a.data.response);}},window.addEventListener("message",r);}))},fa=function(){return window.crypto||window.msCrypto},da=function(){var e=fa();return e.subtle||e.webkitSubtle},ha=function(){var e="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_~.",t="";return Array.from(fa().getRandomValues(new Uint8Array(43))).forEach((function(n){return t+=e[n%e.length]})),t},pa=function(e){return btoa(e)},ya=function(e){return Object.keys(e).filter((function(t){return void 0!==e[t]})).map((function(t){return encodeURIComponent(t)+"="+encodeURIComponent(e[t])})).join("&")},va=function(e){return o(void 0,void 0,void 0,(function(){var t;return i(this,(function(n){switch(n.label){case 0:return t=da().digest({name:"SHA-256"},(new TextEncoder).encode(e)),window.msCrypto?[2,new Promise((function(e,n){t.oncomplete=function(t){e(t.target.result);},t.onerror=function(e){n(e.error);},t.onabort=function(){n("The digest operation was aborted");};}))]:[4,t];case 1:return [2,n.sent()]}}))}))},ma=function(e){return function(e){return decodeURIComponent(atob(e).split("").map((function(e){return "%"+("00"+e.charCodeAt(0).toString(16)).slice(-2)})).join(""))}(e.replace(/_/g,"/").replace(/-/g,"+"))},ga=function(e){var t=new Uint8Array(e);return function(e){var t={"+":"-","/":"_","=":""};return e.replace(/[+/=]/g,(function(e){return t[e]}))}(window.btoa(String.fromCharCode.apply(String,c([],a(Array.from(t)),!1))))};var ba=function(e,t){return o(void 0,void 0,void 0,(function(){var n,r;return i(this,(function(o){switch(o.label){case 0:return [4,(i=e,a=t,a=a||{},new Promise((function(e,t){var n=new XMLHttpRequest,r=[],o=[],c={},s=function(){return {ok:2==(n.status/100|0),statusText:n.statusText,status:n.status,url:n.responseURL,text:function(){return Promise.resolve(n.responseText)},json:function(){return Promise.resolve(n.responseText).then(JSON.parse)},blob:function(){return Promise.resolve(new Blob([n.response]))},clone:s,headers:{keys:function(){return r},entries:function(){return o},get:function(e){return c[e.toLowerCase()]},has:function(e){return e.toLowerCase()in c}}}};for(var u in n.open(a.method||"get",i,!0),n.onload=function(){n.getAllResponseHeaders().replace(/^(.*?):[^\S\n]*([\s\S]*?)$/gm,(function(e,t,n){r.push(t=t.toLowerCase()),o.push([t,n]),c[t]=c[t]?c[t]+","+n:n;})),e(s());},n.onerror=t,n.withCredentials="include"==a.credentials,a.headers)n.setRequestHeader(u,a.headers[u]);n.send(a.body||null);})))];case 1:return n=o.sent(),r={ok:n.ok},[4,n.json()];case 2:return [2,(r.json=o.sent(),r)]}var i,a;}))}))},wa=function(e,t,n){return o(void 0,void 0,void 0,(function(){var r,o;return i(this,(function(i){return r=new AbortController,t.signal=r.signal,[2,Promise.race([ba(e,t),new Promise((function(e,t){o=setTimeout((function(){r.abort(),t(new Error("Timeout when executing 'fetch'"));}),n);}))]).finally((function(){clearTimeout(o);}))]}))}))},Sa=function(e,t,n,r,a,c,s){return o(void 0,void 0,void 0,(function(){return i(this,(function(o){return [2,(i={auth:{audience:t,scope:n},timeout:a,fetchUrl:e,fetchOptions:r,useFormData:s},u=c,new Promise((function(e,t){var n=new MessageChannel;n.port1.onmessage=function(n){n.data.error?t(new Error(n.data.error)):e(n.data);},u.postMessage(i,[n.port2]);})))];var i,u;}))}))},_a=function(e,t,n,r,a,c,s){return void 0===s&&(s=1e4),o(void 0,void 0,void 0,(function(){return i(this,(function(o){return a?[2,Sa(e,t,n,r,s,a,c)]:[2,wa(e,r,s)]}))}))};function ka(e,t,n,a,c,s,u){return o(this,void 0,void 0,(function(){var o,l,f,d,h,p,y,v,m;return i(this,(function(i){switch(i.label){case 0:o=null,f=0,i.label=1;case 1:if(!(f<3))return [3,6];i.label=2;case 2:return i.trys.push([2,4,,5]),[4,_a(e,n,a,c,s,u,t)];case 3:return l=i.sent(),o=null,[3,6];case 4:return d=i.sent(),o=d,[3,5];case 5:return f++,[3,1];case 6:if(o)throw o.message=o.message||"Failed to fetch",o;if(h=l.json,p=h.error,y=h.error_description,v=r(h,["error","error_description"]),!l.ok){if(m=y||"HTTP error. Unable to fetch "+e,"mfa_required"===p)throw new ua(p,m,v.mfa_token);throw new oa(p||"request_error",m)}return [2,v]}}))}))}function Ia(e,t){var n=e.baseUrl,a=e.timeout,c=e.audience,s=e.scope,u=e.auth0Client,l=e.useFormData,f=r(e,["baseUrl","timeout","audience","scope","auth0Client","useFormData"]);return o(this,void 0,void 0,(function(){var e;return i(this,(function(r){switch(r.label){case 0:return e=l?ya(f):JSON.stringify(f),[4,ka(n+"/oauth/token",a,c||"default",s,{method:"POST",body:e,headers:{"Content-Type":l?"application/x-www-form-urlencoded":"application/json","Auth0-Client":btoa(JSON.stringify(u||na))}},t,l)];case 1:return [2,r.sent()]}}))}))}var Ta=function(e){return Array.from(new Set(e))},Oa=function(){for(var e=[],t=0;t<arguments.length;t++)e[t]=arguments[t];return Ta(e.join(" ").trim().split(/\s+/)).join(" ")},Ea=function(){function e(e,t){void 0===t&&(t="@@auth0spajs@@"),this.prefix=t,this.client_id=e.client_id,this.scope=e.scope,this.audience=e.audience;}return e.prototype.toKey=function(){return this.prefix+"::"+this.client_id+"::"+this.audience+"::"+this.scope},e.fromKey=function(t){var n=a(t.split("::"),4),r=n[0],o=n[1],i=n[2];return new e({client_id:o,scope:n[3],audience:i},r)},e.fromCacheEntry=function(t){return new e({scope:t.scope,audience:t.audience,client_id:t.client_id})},e}(),xa=function(){function e(){}return e.prototype.set=function(e,t){localStorage.setItem(e,JSON.stringify(t));},e.prototype.get=function(e){var t=window.localStorage.getItem(e);if(t)try{return JSON.parse(t)}catch(e){return}},e.prototype.remove=function(e){localStorage.removeItem(e);},e.prototype.allKeys=function(){return Object.keys(window.localStorage).filter((function(e){return e.startsWith("@@auth0spajs@@")}))},e}(),Ca=function(){var e;this.enclosedCache=(e={},{set:function(t,n){e[t]=n;},get:function(t){var n=e[t];if(n)return n},remove:function(t){delete e[t];},allKeys:function(){return Object.keys(e)}});},Ra=function(){function e(e,t,n){this.cache=e,this.keyManifest=t,this.nowProvider=n,this.nowProvider=this.nowProvider||ra;}return e.prototype.get=function(e,t){var n;return void 0===t&&(t=0),o(this,void 0,void 0,(function(){var r,o,a,c,s;return i(this,(function(i){switch(i.label){case 0:return [4,this.cache.get(e.toKey())];case 1:return (r=i.sent())?[3,4]:[4,this.getCacheKeys()];case 2:return (o=i.sent())?(a=this.matchExistingCacheKey(e,o),[4,this.cache.get(a)]):[2];case 3:r=i.sent(),i.label=4;case 4:return r?[4,this.nowProvider()]:[2];case 5:return c=i.sent(),s=Math.floor(c/1e3),r.expiresAt-t<s?r.body.refresh_token?(r.body={refresh_token:r.body.refresh_token},[4,this.cache.set(e.toKey(),r)]):[3,7]:[3,10];case 6:return i.sent(),[2,r.body];case 7:return [4,this.cache.remove(e.toKey())];case 8:return i.sent(),[4,null===(n=this.keyManifest)||void 0===n?void 0:n.remove(e.toKey())];case 9:return i.sent(),[2];case 10:return [2,r.body]}}))}))},e.prototype.set=function(e){var t;return o(this,void 0,void 0,(function(){var n,r;return i(this,(function(o){switch(o.label){case 0:return n=new Ea({client_id:e.client_id,scope:e.scope,audience:e.audience}),[4,this.wrapCacheEntry(e)];case 1:return r=o.sent(),[4,this.cache.set(n.toKey(),r)];case 2:return o.sent(),[4,null===(t=this.keyManifest)||void 0===t?void 0:t.add(n.toKey())];case 3:return o.sent(),[2]}}))}))},e.prototype.clear=function(e){var t;return o(this,void 0,void 0,(function(){var n,r=this;return i(this,(function(a){switch(a.label){case 0:return [4,this.getCacheKeys()];case 1:return (n=a.sent())?[4,n.filter((function(t){return !e||t.includes(e)})).reduce((function(e,t){return o(r,void 0,void 0,(function(){return i(this,(function(n){switch(n.label){case 0:return [4,e];case 1:return n.sent(),[4,this.cache.remove(t)];case 2:return n.sent(),[2]}}))}))}),Promise.resolve())]:[2];case 2:return a.sent(),[4,null===(t=this.keyManifest)||void 0===t?void 0:t.clear()];case 3:return a.sent(),[2]}}))}))},e.prototype.clearSync=function(e){var t=this,n=this.cache.allKeys();n&&n.filter((function(t){return !e||t.includes(e)})).forEach((function(e){t.cache.remove(e);}));},e.prototype.wrapCacheEntry=function(e){return o(this,void 0,void 0,(function(){var t,n,r;return i(this,(function(o){switch(o.label){case 0:return [4,this.nowProvider()];case 1:return t=o.sent(),n=Math.floor(t/1e3)+e.expires_in,r=Math.min(n,e.decodedToken.claims.exp),[2,{body:e,expiresAt:r}]}}))}))},e.prototype.getCacheKeys=function(){var e;return o(this,void 0,void 0,(function(){var t;return i(this,(function(n){switch(n.label){case 0:return this.keyManifest?[4,this.keyManifest.get()]:[3,2];case 1:return t=null===(e=n.sent())||void 0===e?void 0:e.keys,[3,4];case 2:return [4,this.cache.allKeys()];case 3:t=n.sent(),n.label=4;case 4:return [2,t]}}))}))},e.prototype.matchExistingCacheKey=function(e,t){return t.filter((function(t){var n=Ea.fromKey(t),r=new Set(n.scope&&n.scope.split(" ")),o=e.scope.split(" "),i=n.scope&&o.reduce((function(e,t){return e&&r.has(t)}),!0);return "@@auth0spajs@@"===n.prefix&&n.client_id===e.client_id&&n.audience===e.audience&&i}))[0]},e}(),Fa=function(){function e(e,t){this.storage=e,this.clientId=t,this.storageKey="a0.spajs.txs."+this.clientId,this.transaction=this.storage.get(this.storageKey);}return e.prototype.create=function(e){this.transaction=e,this.storage.save(this.storageKey,e,{daysUntilExpire:1});},e.prototype.get=function(){return this.transaction},e.prototype.remove=function(){delete this.transaction,this.storage.remove(this.storageKey);},e}(),Aa=function(e){return "number"==typeof e},ja=["iss","aud","exp","nbf","iat","jti","azp","nonce","auth_time","at_hash","c_hash","acr","amr","sub_jwk","cnf","sip_from_tag","sip_date","sip_callid","sip_cseq_num","sip_via_branch","orig","dest","mky","events","toe","txn","rph","sid","vot","vtm"],Ua=function(e){if(!e.id_token)throw new Error("ID token is required but missing");var t=function(e){var t=e.split("."),n=a(t,3),r=n[0],o=n[1],i=n[2];if(3!==t.length||!r||!o||!i)throw new Error("ID token could not be decoded");var c=JSON.parse(ma(o)),s={__raw:e},u={};return Object.keys(c).forEach((function(e){s[e]=c[e],ja.includes(e)||(u[e]=c[e]);})),{encoded:{header:r,payload:o,signature:i},header:JSON.parse(ma(r)),claims:s,user:u}}(e.id_token);if(!t.claims.iss)throw new Error("Issuer (iss) claim must be a string present in the ID token");if(t.claims.iss!==e.iss)throw new Error('Issuer (iss) claim mismatch in the ID token; expected "'+e.iss+'", found "'+t.claims.iss+'"');if(!t.user.sub)throw new Error("Subject (sub) claim must be a string present in the ID token");if("RS256"!==t.header.alg)throw new Error('Signature algorithm of "'+t.header.alg+'" is not supported. Expected the ID token to be signed with "RS256".');if(!t.claims.aud||"string"!=typeof t.claims.aud&&!Array.isArray(t.claims.aud))throw new Error("Audience (aud) claim must be a string or array of strings present in the ID token");if(Array.isArray(t.claims.aud)){if(!t.claims.aud.includes(e.aud))throw new Error('Audience (aud) claim mismatch in the ID token; expected "'+e.aud+'" but was not one of "'+t.claims.aud.join(", ")+'"');if(t.claims.aud.length>1){if(!t.claims.azp)throw new Error("Authorized Party (azp) claim must be a string present in the ID token when Audience (aud) claim has multiple values");if(t.claims.azp!==e.aud)throw new Error('Authorized Party (azp) claim mismatch in the ID token; expected "'+e.aud+'", found "'+t.claims.azp+'"')}}else if(t.claims.aud!==e.aud)throw new Error('Audience (aud) claim mismatch in the ID token; expected "'+e.aud+'" but found "'+t.claims.aud+'"');if(e.nonce){if(!t.claims.nonce)throw new Error("Nonce (nonce) claim must be a string present in the ID token");if(t.claims.nonce!==e.nonce)throw new Error('Nonce (nonce) claim mismatch in the ID token; expected "'+e.nonce+'", found "'+t.claims.nonce+'"')}if(e.max_age&&!Aa(t.claims.auth_time))throw new Error("Authentication Time (auth_time) claim must be a number present in the ID token when Max Age (max_age) is specified");if(!Aa(t.claims.exp))throw new Error("Expiration Time (exp) claim must be a number present in the ID token");if(!Aa(t.claims.iat))throw new Error("Issued At (iat) claim must be a number present in the ID token");var n=e.leeway||60,r=new Date(e.now||Date.now()),o=new Date(0),i=new Date(0),c=new Date(0);if(c.setUTCSeconds(parseInt(t.claims.auth_time)+e.max_age+n),o.setUTCSeconds(t.claims.exp+n),i.setUTCSeconds(t.claims.nbf-n),r>o)throw new Error("Expiration Time (exp) claim error in the ID token; current time ("+r+") is after expiration time ("+o+")");if(Aa(t.claims.nbf)&&r<i)throw new Error("Not Before time (nbf) claim in the ID token indicates that this token can't be used just yet. Currrent time ("+r+") is before "+i);if(Aa(t.claims.auth_time)&&r>c)throw new Error("Authentication Time (auth_time) claim in the ID token indicates that too much time has passed since the last end-user authentication. Currrent time ("+r+") is after last auth at "+c);if(e.organizationId){if(!t.claims.org_id)throw new Error("Organization ID (org_id) claim must be a string present in the ID token");if(e.organizationId!==t.claims.org_id)throw new Error('Organization ID (org_id) claim mismatch in the ID token; expected "'+e.organizationId+'", found "'+t.claims.org_id+'"')}return t},Ka=l((function(e,t){var n=s&&s.__assign||function(){return (n=Object.assign||function(e){for(var t,n=1,r=arguments.length;n<r;n++)for(var o in t=arguments[n])Object.prototype.hasOwnProperty.call(t,o)&&(e[o]=t[o]);return e}).apply(this,arguments)};function r(e,t){if(!t)return "";var n="; "+e;return !0===t?n:n+"="+t}function o(e,t,n){return encodeURIComponent(e).replace(/%(23|24|26|2B|5E|60|7C)/g,decodeURIComponent).replace(/\(/g,"%28").replace(/\)/g,"%29")+"="+encodeURIComponent(t).replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g,decodeURIComponent)+function(e){if("number"==typeof e.expires){var t=new Date;t.setMilliseconds(t.getMilliseconds()+864e5*e.expires),e.expires=t;}return r("Expires",e.expires?e.expires.toUTCString():"")+r("Domain",e.domain)+r("Path",e.path)+r("Secure",e.secure)+r("SameSite",e.sameSite)}(n)}function i(e){for(var t={},n=e?e.split("; "):[],r=/(%[\dA-F]{2})+/gi,o=0;o<n.length;o++){var i=n[o].split("="),a=i.slice(1).join("=");'"'===a.charAt(0)&&(a=a.slice(1,-1));try{t[i[0].replace(r,decodeURIComponent)]=a.replace(r,decodeURIComponent);}catch(e){}}return t}function a(){return i(document.cookie)}function c(e,t,r){document.cookie=o(e,t,n({path:"/"},r));}t.__esModule=!0,t.encode=o,t.parse=i,t.getAll=a,t.get=function(e){return a()[e]},t.set=c,t.remove=function(e,t){c(e,"",n(n({},t),{expires:-1}));};}));u(Ka),Ka.encode,Ka.parse,Ka.getAll;var Pa=Ka.get,La=Ka.set,Wa=Ka.remove,Za={get:function(e){var t=Pa(e);if(void 0!==t)return JSON.parse(t)},save:function(e,t,n){var r={};"https:"===window.location.protocol&&(r={secure:!0,sameSite:"none"}),(null==n?void 0:n.daysUntilExpire)&&(r.expires=n.daysUntilExpire),La(e,JSON.stringify(t),r);},remove:function(e){Wa(e);}},Va={get:function(e){var t=Za.get(e);return t||Za.get("_legacy_"+e)},save:function(e,t,n){var r={};"https:"===window.location.protocol&&(r={secure:!0}),(null==n?void 0:n.daysUntilExpire)&&(r.expires=n.daysUntilExpire),La("_legacy_"+e,JSON.stringify(t),r),Za.save(e,t,n);},remove:function(e){Za.remove(e),Za.remove("_legacy_"+e);}},Na={get:function(e){if("undefined"!=typeof sessionStorage){var t=sessionStorage.getItem(e);if(void 0!==t)return JSON.parse(t)}},save:function(e,t){sessionStorage.setItem(e,JSON.stringify(t));},remove:function(e){sessionStorage.removeItem(e);}};function Xa(e,t,n){var r=void 0===t?null:t,o=function(e,t){var n=atob(e);if(t){for(var r=new Uint8Array(n.length),o=0,i=n.length;o<i;++o)r[o]=n.charCodeAt(o);return String.fromCharCode.apply(null,new Uint16Array(r.buffer))}return n}(e,void 0!==n&&n),i=o.indexOf("\n",10)+1,a=o.substring(i)+(r?"//# sourceMappingURL="+r:""),c=new Blob([a],{type:"application/javascript"});return URL.createObjectURL(c)}var Da,za,Ya,Ja,Ba=(Da="Lyogcm9sbHVwLXBsdWdpbi13ZWItd29ya2VyLWxvYWRlciAqLwohZnVuY3Rpb24oKXsidXNlIHN0cmljdCI7Ci8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKgogICAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uCgogICAgUGVybWlzc2lvbiB0byB1c2UsIGNvcHksIG1vZGlmeSwgYW5kL29yIGRpc3RyaWJ1dGUgdGhpcyBzb2Z0d2FyZSBmb3IgYW55CiAgICBwdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuCgogICAgVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEICJBUyBJUyIgQU5EIFRIRSBBVVRIT1IgRElTQ0xBSU1TIEFMTCBXQVJSQU5USUVTIFdJVEgKICAgIFJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWQogICAgQU5EIEZJVE5FU1MuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1IgQkUgTElBQkxFIEZPUiBBTlkgU1BFQ0lBTCwgRElSRUNULAogICAgSU5ESVJFQ1QsIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyBPUiBBTlkgREFNQUdFUyBXSEFUU09FVkVSIFJFU1VMVElORyBGUk9NCiAgICBMT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUgogICAgT1RIRVIgVE9SVElPVVMgQUNUSU9OLCBBUklTSU5HIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFVTRSBPUgogICAgUEVSRk9STUFOQ0UgT0YgVEhJUyBTT0ZUV0FSRS4KICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovdmFyIGU9ZnVuY3Rpb24oKXtyZXR1cm4oZT1PYmplY3QuYXNzaWdufHxmdW5jdGlvbihlKXtmb3IodmFyIHIsdD0xLG49YXJndW1lbnRzLmxlbmd0aDt0PG47dCsrKWZvcih2YXIgbyBpbiByPWFyZ3VtZW50c1t0XSlPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocixvKSYmKGVbb109cltvXSk7cmV0dXJuIGV9KS5hcHBseSh0aGlzLGFyZ3VtZW50cyl9O2Z1bmN0aW9uIHIoZSxyLHQsbil7cmV0dXJuIG5ldyh0fHwodD1Qcm9taXNlKSkoKGZ1bmN0aW9uKG8sYSl7ZnVuY3Rpb24gcyhlKXt0cnl7dShuLm5leHQoZSkpfWNhdGNoKGUpe2EoZSl9fWZ1bmN0aW9uIGkoZSl7dHJ5e3Uobi50aHJvdyhlKSl9Y2F0Y2goZSl7YShlKX19ZnVuY3Rpb24gdShlKXt2YXIgcjtlLmRvbmU/byhlLnZhbHVlKToocj1lLnZhbHVlLHIgaW5zdGFuY2VvZiB0P3I6bmV3IHQoKGZ1bmN0aW9uKGUpe2Uocil9KSkpLnRoZW4ocyxpKX11KChuPW4uYXBwbHkoZSxyfHxbXSkpLm5leHQoKSl9KSl9ZnVuY3Rpb24gdChlLHIpe3ZhciB0LG4sbyxhLHM9e2xhYmVsOjAsc2VudDpmdW5jdGlvbigpe2lmKDEmb1swXSl0aHJvdyBvWzFdO3JldHVybiBvWzFdfSx0cnlzOltdLG9wczpbXX07cmV0dXJuIGE9e25leHQ6aSgwKSx0aHJvdzppKDEpLHJldHVybjppKDIpfSwiZnVuY3Rpb24iPT10eXBlb2YgU3ltYm9sJiYoYVtTeW1ib2wuaXRlcmF0b3JdPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXN9KSxhO2Z1bmN0aW9uIGkoYSl7cmV0dXJuIGZ1bmN0aW9uKGkpe3JldHVybiBmdW5jdGlvbihhKXtpZih0KXRocm93IG5ldyBUeXBlRXJyb3IoIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy4iKTtmb3IoO3M7KXRyeXtpZih0PTEsbiYmKG89MiZhWzBdP24ucmV0dXJuOmFbMF0/bi50aHJvd3x8KChvPW4ucmV0dXJuKSYmby5jYWxsKG4pLDApOm4ubmV4dCkmJiEobz1vLmNhbGwobixhWzFdKSkuZG9uZSlyZXR1cm4gbztzd2l0Y2gobj0wLG8mJihhPVsyJmFbMF0sby52YWx1ZV0pLGFbMF0pe2Nhc2UgMDpjYXNlIDE6bz1hO2JyZWFrO2Nhc2UgNDpyZXR1cm4gcy5sYWJlbCsrLHt2YWx1ZTphWzFdLGRvbmU6ITF9O2Nhc2UgNTpzLmxhYmVsKyssbj1hWzFdLGE9WzBdO2NvbnRpbnVlO2Nhc2UgNzphPXMub3BzLnBvcCgpLHMudHJ5cy5wb3AoKTtjb250aW51ZTtkZWZhdWx0OmlmKCEobz1zLnRyeXMsKG89by5sZW5ndGg+MCYmb1tvLmxlbmd0aC0xXSl8fDYhPT1hWzBdJiYyIT09YVswXSkpe3M9MDtjb250aW51ZX1pZigzPT09YVswXSYmKCFvfHxhWzFdPm9bMF0mJmFbMV08b1szXSkpe3MubGFiZWw9YVsxXTticmVha31pZig2PT09YVswXSYmcy5sYWJlbDxvWzFdKXtzLmxhYmVsPW9bMV0sbz1hO2JyZWFrfWlmKG8mJnMubGFiZWw8b1syXSl7cy5sYWJlbD1vWzJdLHMub3BzLnB1c2goYSk7YnJlYWt9b1syXSYmcy5vcHMucG9wKCkscy50cnlzLnBvcCgpO2NvbnRpbnVlfWE9ci5jYWxsKGUscyl9Y2F0Y2goZSl7YT1bNixlXSxuPTB9ZmluYWxseXt0PW89MH1pZig1JmFbMF0pdGhyb3cgYVsxXTtyZXR1cm57dmFsdWU6YVswXT9hWzFdOnZvaWQgMCxkb25lOiEwfX0oW2EsaV0pfX19dmFyIG49e30sbz1mdW5jdGlvbihlLHIpe3JldHVybiBlKyJ8IityfTthZGRFdmVudExpc3RlbmVyKCJtZXNzYWdlIiwoZnVuY3Rpb24oYSl7dmFyIHM9YS5kYXRhLGk9cy50aW1lb3V0LHU9cy5hdXRoLGM9cy5mZXRjaFVybCxmPXMuZmV0Y2hPcHRpb25zLGw9cy51c2VGb3JtRGF0YSxoPWZ1bmN0aW9uKGUscil7dmFyIHQ9ImZ1bmN0aW9uIj09dHlwZW9mIFN5bWJvbCYmZVtTeW1ib2wuaXRlcmF0b3JdO2lmKCF0KXJldHVybiBlO3ZhciBuLG8sYT10LmNhbGwoZSkscz1bXTt0cnl7Zm9yKDsodm9pZCAwPT09cnx8ci0tID4wKSYmIShuPWEubmV4dCgpKS5kb25lOylzLnB1c2gobi52YWx1ZSl9Y2F0Y2goZSl7bz17ZXJyb3I6ZX19ZmluYWxseXt0cnl7biYmIW4uZG9uZSYmKHQ9YS5yZXR1cm4pJiZ0LmNhbGwoYSl9ZmluYWxseXtpZihvKXRocm93IG8uZXJyb3J9fXJldHVybiBzfShhLnBvcnRzLDEpWzBdO3JldHVybiByKHZvaWQgMCx2b2lkIDAsdm9pZCAwLChmdW5jdGlvbigpe3ZhciByLGEscyxwLHksYixkLHYsdyxnO3JldHVybiB0KHRoaXMsKGZ1bmN0aW9uKHQpe3N3aXRjaCh0LmxhYmVsKXtjYXNlIDA6cz0oYT11fHx7fSkuYXVkaWVuY2UscD1hLnNjb3BlLHQubGFiZWw9MTtjYXNlIDE6aWYodC50cnlzLnB1c2goWzEsNywsOF0pLCEoeT1sPyhrPWYuYm9keSxTPW5ldyBVUkxTZWFyY2hQYXJhbXMoayksXz17fSxTLmZvckVhY2goKGZ1bmN0aW9uKGUscil7X1tyXT1lfSkpLF8pOkpTT04ucGFyc2UoZi5ib2R5KSkucmVmcmVzaF90b2tlbiYmInJlZnJlc2hfdG9rZW4iPT09eS5ncmFudF90eXBlKXtpZighKGI9ZnVuY3Rpb24oZSxyKXtyZXR1cm4gbltvKGUscildfShzLHApKSl0aHJvdyBuZXcgRXJyb3IoIlRoZSB3ZWIgd29ya2VyIGlzIG1pc3NpbmcgdGhlIHJlZnJlc2ggdG9rZW4iKTtmLmJvZHk9bD9uZXcgVVJMU2VhcmNoUGFyYW1zKGUoZSh7fSx5KSx7cmVmcmVzaF90b2tlbjpifSkpLnRvU3RyaW5nKCk6SlNPTi5zdHJpbmdpZnkoZShlKHt9LHkpLHtyZWZyZXNoX3Rva2VuOmJ9KSl9ZD12b2lkIDAsImZ1bmN0aW9uIj09dHlwZW9mIEFib3J0Q29udHJvbGxlciYmKGQ9bmV3IEFib3J0Q29udHJvbGxlcixmLnNpZ25hbD1kLnNpZ25hbCksdj12b2lkIDAsdC5sYWJlbD0yO2Nhc2UgMjpyZXR1cm4gdC50cnlzLnB1c2goWzIsNCwsNV0pLFs0LFByb21pc2UucmFjZShbKG09aSxuZXcgUHJvbWlzZSgoZnVuY3Rpb24oZSl7cmV0dXJuIHNldFRpbWVvdXQoZSxtKX0pKSksZmV0Y2goYyxlKHt9LGYpKV0pXTtjYXNlIDM6cmV0dXJuIHY9dC5zZW50KCksWzMsNV07Y2FzZSA0OnJldHVybiB3PXQuc2VudCgpLGgucG9zdE1lc3NhZ2Uoe2Vycm9yOncubWVzc2FnZX0pLFsyXTtjYXNlIDU6cmV0dXJuIHY/WzQsdi5qc29uKCldOihkJiZkLmFib3J0KCksaC5wb3N0TWVzc2FnZSh7ZXJyb3I6IlRpbWVvdXQgd2hlbiBleGVjdXRpbmcgJ2ZldGNoJyJ9KSxbMl0pO2Nhc2UgNjpyZXR1cm4ocj10LnNlbnQoKSkucmVmcmVzaF90b2tlbj8oZnVuY3Rpb24oZSxyLHQpe25bbyhyLHQpXT1lfShyLnJlZnJlc2hfdG9rZW4scyxwKSxkZWxldGUgci5yZWZyZXNoX3Rva2VuKTpmdW5jdGlvbihlLHIpe2RlbGV0ZSBuW28oZSxyKV19KHMscCksaC5wb3N0TWVzc2FnZSh7b2s6di5vayxqc29uOnJ9KSxbMyw4XTtjYXNlIDc6cmV0dXJuIGc9dC5zZW50KCksaC5wb3N0TWVzc2FnZSh7b2s6ITEsanNvbjp7ZXJyb3JfZGVzY3JpcHRpb246Zy5tZXNzYWdlfX0pLFszLDhdO2Nhc2UgODpyZXR1cm5bMl19dmFyIG0sayxTLF99KSl9KSl9KSl9KCk7Cgo=",za=null,Ya=!1,function(e){return Ja=Ja||Xa(Da,za,Ya),new Worker(Ja,e)}),Ga={},Ma=function(){function e(e,t){this.cache=e,this.clientId=t,this.manifestKey=this.createManifestKeyFrom(this.clientId);}return e.prototype.add=function(e){var t;return o(this,void 0,void 0,(function(){var n,r;return i(this,(function(o){switch(o.label){case 0:return r=Set.bind,[4,this.cache.get(this.manifestKey)];case 1:return (n=new(r.apply(Set,[void 0,(null===(t=o.sent())||void 0===t?void 0:t.keys)||[]]))).add(e),[4,this.cache.set(this.manifestKey,{keys:c([],a(n),!1)})];case 2:return o.sent(),[2]}}))}))},e.prototype.remove=function(e){return o(this,void 0,void 0,(function(){var t,n;return i(this,(function(r){switch(r.label){case 0:return [4,this.cache.get(this.manifestKey)];case 1:return (t=r.sent())?((n=new Set(t.keys)).delete(e),n.size>0?[4,this.cache.set(this.manifestKey,{keys:c([],a(n),!1)})]:[3,3]):[3,5];case 2:return [2,r.sent()];case 3:return [4,this.cache.remove(this.manifestKey)];case 4:return [2,r.sent()];case 5:return [2]}}))}))},e.prototype.get=function(){return this.cache.get(this.manifestKey)},e.prototype.clear=function(){return this.cache.remove(this.manifestKey)},e.prototype.createManifestKeyFrom=function(e){return "@@auth0spajs@@::"+e},e}(),Ha=new $i,qa={memory:function(){return (new Ca).enclosedCache},localstorage:function(){return new xa}},Qa=function(e){return qa[e]},$a=function(){return !/Trident.*rv:11\.0/.test(navigator.userAgent)},ec=function(){function e(e){var t,n,o;if(this.options=e,"undefined"!=typeof window&&function(){if(!fa())throw new Error("For security reasons, `window.crypto` is required to run `auth0-spa-js`.");if(void 0===da())throw new Error("\n      auth0-spa-js must run on a secure origin. See https://github.com/auth0/auth0-spa-js/blob/master/FAQ.md#why-do-i-get-auth0-spa-js-must-run-on-a-secure-origin for more information.\n    ")}(),e.cache&&e.cacheLocation&&console.warn("Both `cache` and `cacheLocation` options have been specified in the Auth0Client configuration; ignoring `cacheLocation` and using `cache`."),e.cache)o=e.cache;else {if(this.cacheLocation=e.cacheLocation||"memory",!Qa(this.cacheLocation))throw new Error('Invalid cache location "'+this.cacheLocation+'"');o=Qa(this.cacheLocation)();}this.cookieStorage=!1===e.legacySameSiteCookie?Za:Va,this.orgHintCookieName="auth0."+this.options.client_id+".organization_hint",this.isAuthenticatedCookieName=function(e){return "auth0."+e+".is.authenticated"}(this.options.client_id),this.sessionCheckExpiryDays=e.sessionCheckExpiryDays||1;var i,a=e.useCookiesForTransactions?this.cookieStorage:Na;this.scope=this.options.scope,this.transactionManager=new Fa(a,this.options.client_id),this.nowProvider=this.options.nowProvider||ra,this.cacheManager=new Ra(o,o.allKeys?null:new Ma(o,this.options.client_id),this.nowProvider),this.domainUrl=(i=this.options.domain,/^https?:\/\//.test(i)?i:"https://"+i),this.tokenIssuer=function(e,t){return e?e.startsWith("https://")?e:"https://"+e+"/":t+"/"}(this.options.issuer,this.domainUrl),this.defaultScope=Oa("openid",void 0!==(null===(n=null===(t=this.options)||void 0===t?void 0:t.advancedOptions)||void 0===n?void 0:n.defaultScope)?this.options.advancedOptions.defaultScope:"openid profile email"),this.options.useRefreshTokens&&(this.scope=Oa(this.scope,"offline_access")),"undefined"!=typeof window&&window.Worker&&this.options.useRefreshTokens&&"memory"===this.cacheLocation&&$a()&&(this.worker=new Ba),this.customOptions=function(e){return e.advancedOptions,e.audience,e.auth0Client,e.authorizeTimeoutInSeconds,e.cacheLocation,e.client_id,e.domain,e.issuer,e.leeway,e.max_age,e.redirect_uri,e.scope,e.useRefreshTokens,e.useCookiesForTransactions,e.useFormData,r(e,["advancedOptions","audience","auth0Client","authorizeTimeoutInSeconds","cacheLocation","client_id","domain","issuer","leeway","max_age","redirect_uri","scope","useRefreshTokens","useCookiesForTransactions","useFormData"])}(e);}return e.prototype._url=function(e){var t=encodeURIComponent(btoa(JSON.stringify(this.options.auth0Client||na)));return ""+this.domainUrl+e+"&auth0Client="+t},e.prototype._getParams=function(e,t,o,i,a){var c=this.options;c.useRefreshTokens,c.useCookiesForTransactions,c.useFormData,c.auth0Client,c.cacheLocation,c.advancedOptions,c.detailedResponse,c.nowProvider,c.authorizeTimeoutInSeconds,c.legacySameSiteCookie,c.sessionCheckExpiryDays,c.domain,c.leeway;var s=r(c,["useRefreshTokens","useCookiesForTransactions","useFormData","auth0Client","cacheLocation","advancedOptions","detailedResponse","nowProvider","authorizeTimeoutInSeconds","legacySameSiteCookie","sessionCheckExpiryDays","domain","leeway"]);return n(n(n({},s),e),{scope:Oa(this.defaultScope,this.scope,e.scope),response_type:"code",response_mode:"query",state:t,nonce:o,redirect_uri:a||this.options.redirect_uri,code_challenge:i,code_challenge_method:"S256"})},e.prototype._authorizeUrl=function(e){return this._url("/authorize?"+ya(e))},e.prototype._verifyIdToken=function(e,t,n){return o(this,void 0,void 0,(function(){var r;return i(this,(function(o){switch(o.label){case 0:return [4,this.nowProvider()];case 1:return r=o.sent(),[2,Ua({iss:this.tokenIssuer,aud:this.options.client_id,id_token:e,nonce:t,organizationId:n,leeway:this.options.leeway,max_age:this._parseNumber(this.options.max_age),now:r})]}}))}))},e.prototype._parseNumber=function(e){return "string"!=typeof e?e:parseInt(e,10)||void 0},e.prototype._processOrgIdHint=function(e){e?this.cookieStorage.save(this.orgHintCookieName,e):this.cookieStorage.remove(this.orgHintCookieName);},e.prototype.buildAuthorizeUrl=function(e){return void 0===e&&(e={}),o(this,void 0,void 0,(function(){var t,o,a,c,s,u,l,f,d,h,p,y;return i(this,(function(i){switch(i.label){case 0:return t=e.redirect_uri,o=e.appState,a=r(e,["redirect_uri","appState"]),c=pa(ha()),s=pa(ha()),u=ha(),[4,va(u)];case 1:return l=i.sent(),f=ga(l),d=e.fragment?"#"+e.fragment:"",h=this._getParams(a,c,s,f,t),p=this._authorizeUrl(h),y=e.organization||this.options.organization,this.transactionManager.create(n({nonce:s,code_verifier:u,appState:o,scope:h.scope,audience:h.audience||"default",redirect_uri:h.redirect_uri,state:c},y&&{organizationId:y})),[2,p+d]}}))}))},e.prototype.loginWithPopup=function(e,t){return o(this,void 0,void 0,(function(){var o,a,c,s,u,l,f,d,h,p,y,v,m;return i(this,(function(i){switch(i.label){case 0:return e=e||{},(t=t||{}).popup||(t.popup=function(e){var t=window.screenX+(window.innerWidth-400)/2,n=window.screenY+(window.innerHeight-600)/2;return window.open(e,"auth0:authorize:popup","left="+t+",top="+n+",width=400,height=600,resizable,scrollbars=yes,status=1")}("")),o=r(e,[]),a=pa(ha()),c=pa(ha()),s=ha(),[4,va(s)];case 1:return u=i.sent(),l=ga(u),f=this._getParams(o,a,c,l,this.options.redirect_uri||window.location.origin),d=this._authorizeUrl(n(n({},f),{response_mode:"web_message"})),t.popup.location.href=d,[4,la(n(n({},t),{timeoutInSeconds:t.timeoutInSeconds||this.options.authorizeTimeoutInSeconds||60}))];case 2:if(h=i.sent(),a!==h.state)throw new Error("Invalid state");return [4,Ia({audience:f.audience,scope:f.scope,baseUrl:this.domainUrl,client_id:this.options.client_id,code_verifier:s,code:h.code,grant_type:"authorization_code",redirect_uri:f.redirect_uri,auth0Client:this.options.auth0Client,useFormData:this.options.useFormData},this.worker)];case 3:return p=i.sent(),y=e.organization||this.options.organization,[4,this._verifyIdToken(p.id_token,c,y)];case 4:return v=i.sent(),m=n(n({},p),{decodedToken:v,scope:f.scope,audience:f.audience||"default",client_id:this.options.client_id}),[4,this.cacheManager.set(m)];case 5:return i.sent(),this.cookieStorage.save(this.isAuthenticatedCookieName,!0,{daysUntilExpire:this.sessionCheckExpiryDays}),this._processOrgIdHint(v.claims.org_id),[2]}}))}))},e.prototype.getUser=function(e){return void 0===e&&(e={}),o(this,void 0,void 0,(function(){var t,n,r;return i(this,(function(o){switch(o.label){case 0:return t=e.audience||this.options.audience||"default",n=Oa(this.defaultScope,this.scope,e.scope),[4,this.cacheManager.get(new Ea({client_id:this.options.client_id,audience:t,scope:n}))];case 1:return [2,(r=o.sent())&&r.decodedToken&&r.decodedToken.user]}}))}))},e.prototype.getIdTokenClaims=function(e){return void 0===e&&(e={}),o(this,void 0,void 0,(function(){var t,n,r;return i(this,(function(o){switch(o.label){case 0:return t=e.audience||this.options.audience||"default",n=Oa(this.defaultScope,this.scope,e.scope),[4,this.cacheManager.get(new Ea({client_id:this.options.client_id,audience:t,scope:n}))];case 1:return [2,(r=o.sent())&&r.decodedToken&&r.decodedToken.claims]}}))}))},e.prototype.loginWithRedirect=function(e){return void 0===e&&(e={}),o(this,void 0,void 0,(function(){var t,n,o;return i(this,(function(i){switch(i.label){case 0:return t=e.redirectMethod,n=r(e,["redirectMethod"]),[4,this.buildAuthorizeUrl(n)];case 1:return o=i.sent(),window.location[t||"assign"](o),[2]}}))}))},e.prototype.handleRedirectCallback=function(e){return void 0===e&&(e=window.location.href),o(this,void 0,void 0,(function(){var t,r,o,c,s,u,l,f,d,h;return i(this,(function(i){switch(i.label){case 0:if(0===(t=e.split("?").slice(1)).length)throw new Error("There are no query params available for parsing.");if(r=function(e){e.indexOf("#")>-1&&(e=e.substr(0,e.indexOf("#")));var t=e.split("&"),n={};return t.forEach((function(e){var t=a(e.split("="),2),r=t[0],o=t[1];n[r]=decodeURIComponent(o);})),n.expires_in&&(n.expires_in=parseInt(n.expires_in)),n}(t.join("")),o=r.state,c=r.code,s=r.error,u=r.error_description,!(l=this.transactionManager.get()))throw new Error("Invalid state");if(this.transactionManager.remove(),s)throw new ia(s,u,o,l.appState);if(!l.code_verifier||l.state&&l.state!==o)throw new Error("Invalid state");return f={audience:l.audience,scope:l.scope,baseUrl:this.domainUrl,client_id:this.options.client_id,code_verifier:l.code_verifier,grant_type:"authorization_code",code:c,auth0Client:this.options.auth0Client,useFormData:this.options.useFormData},void 0!==l.redirect_uri&&(f.redirect_uri=l.redirect_uri),[4,Ia(f,this.worker)];case 1:return d=i.sent(),[4,this._verifyIdToken(d.id_token,l.nonce,l.organizationId)];case 2:return h=i.sent(),[4,this.cacheManager.set(n(n(n(n({},d),{decodedToken:h,audience:l.audience,scope:l.scope}),d.scope?{oauthTokenScope:d.scope}:null),{client_id:this.options.client_id}))];case 3:return i.sent(),this.cookieStorage.save(this.isAuthenticatedCookieName,!0,{daysUntilExpire:this.sessionCheckExpiryDays}),this._processOrgIdHint(h.claims.org_id),[2,{appState:l.appState}]}}))}))},e.prototype.checkSession=function(e){return o(this,void 0,void 0,(function(){var t;return i(this,(function(n){switch(n.label){case 0:if(!this.cookieStorage.get(this.isAuthenticatedCookieName)){if(!this.cookieStorage.get("auth0.is.authenticated"))return [2];this.cookieStorage.save(this.isAuthenticatedCookieName,!0,{daysUntilExpire:this.sessionCheckExpiryDays}),this.cookieStorage.remove("auth0.is.authenticated");}n.label=1;case 1:return n.trys.push([1,3,,4]),[4,this.getTokenSilently(e)];case 2:return n.sent(),[3,4];case 3:if(t=n.sent(),!ta.includes(t.error))throw t;return [3,4];case 4:return [2]}}))}))},e.prototype.getTokenSilently=function(e){return void 0===e&&(e={}),o(this,void 0,void 0,(function(){var t,o,a,c=this;return i(this,(function(i){return t=n(n({audience:this.options.audience,ignoreCache:!1},e),{scope:Oa(this.defaultScope,this.scope,e.scope)}),o=t.ignoreCache,a=r(t,["ignoreCache"]),[2,(s=function(){return c._getTokenSilently(n({ignoreCache:o},a))},u=this.options.client_id+"::"+a.audience+"::"+a.scope,l=Ga[u],l||(l=s().finally((function(){delete Ga[u],l=null;})),Ga[u]=l),l)];var s,u,l;}))}))},e.prototype._getTokenSilently=function(e){return void 0===e&&(e={}),o(this,void 0,void 0,(function(){var t,a,c,s,u,l,f,d,h;return i(this,(function(p){switch(p.label){case 0:return t=e.ignoreCache,a=r(e,["ignoreCache"]),t?[3,2]:[4,this._getEntryFromCache({scope:a.scope,audience:a.audience||"default",client_id:this.options.client_id,getDetailedEntry:e.detailedResponse})];case 1:if(c=p.sent())return [2,c];p.label=2;case 2:return [4,(y=function(){return Ha.acquireLock("auth0.lock.getTokenSilently",5e3)},v=10,void 0===v&&(v=3),o(void 0,void 0,void 0,(function(){var e;return i(this,(function(t){switch(t.label){case 0:e=0,t.label=1;case 1:return e<v?[4,y()]:[3,4];case 2:if(t.sent())return [2,!0];t.label=3;case 3:return e++,[3,1];case 4:return [2,!1]}}))})))];case 3:if(!p.sent())return [3,15];p.label=4;case 4:return p.trys.push([4,,12,14]),t?[3,6]:[4,this._getEntryFromCache({scope:a.scope,audience:a.audience||"default",client_id:this.options.client_id,getDetailedEntry:e.detailedResponse})];case 5:if(c=p.sent())return [2,c];p.label=6;case 6:return this.options.useRefreshTokens?[4,this._getTokenUsingRefreshToken(a)]:[3,8];case 7:return u=p.sent(),[3,10];case 8:return [4,this._getTokenFromIFrame(a)];case 9:u=p.sent(),p.label=10;case 10:return s=u,[4,this.cacheManager.set(n({client_id:this.options.client_id},s))];case 11:return p.sent(),this.cookieStorage.save(this.isAuthenticatedCookieName,!0,{daysUntilExpire:this.sessionCheckExpiryDays}),e.detailedResponse?(l=s.id_token,f=s.access_token,d=s.oauthTokenScope,h=s.expires_in,[2,n(n({id_token:l,access_token:f},d?{scope:d}:null),{expires_in:h})]):[2,s.access_token];case 12:return [4,Ha.releaseLock("auth0.lock.getTokenSilently")];case 13:return p.sent(),[7];case 14:return [3,16];case 15:throw new aa;case 16:return [2]}var y,v;}))}))},e.prototype.getTokenWithPopup=function(e,t){return void 0===e&&(e={}),void 0===t&&(t={}),o(this,void 0,void 0,(function(){return i(this,(function(r){switch(r.label){case 0:return e.audience=e.audience||this.options.audience,e.scope=Oa(this.defaultScope,this.scope,e.scope),t=n(n({},ea),t),[4,this.loginWithPopup(e,t)];case 1:return r.sent(),[4,this.cacheManager.get(new Ea({scope:e.scope,audience:e.audience||"default",client_id:this.options.client_id}))];case 2:return [2,r.sent().access_token]}}))}))},e.prototype.isAuthenticated=function(){return o(this,void 0,void 0,(function(){return i(this,(function(e){switch(e.label){case 0:return [4,this.getUser()];case 1:return [2,!!e.sent()]}}))}))},e.prototype.buildLogoutUrl=function(e){void 0===e&&(e={}),null!==e.client_id?e.client_id=e.client_id||this.options.client_id:delete e.client_id;var t=e.federated,n=r(e,["federated"]),o=t?"&federated":"";return this._url("/v2/logout?"+ya(n))+o},e.prototype.logout=function(e){var t=this;void 0===e&&(e={});var n=e.localOnly,o=r(e,["localOnly"]);if(n&&o.federated)throw new Error("It is invalid to set both the `federated` and `localOnly` options to `true`");var i=function(){if(t.cookieStorage.remove(t.orgHintCookieName),t.cookieStorage.remove(t.isAuthenticatedCookieName),!n){var e=t.buildLogoutUrl(o);window.location.assign(e);}};if(this.options.cache)return this.cacheManager.clear().then((function(){return i()}));this.cacheManager.clearSync(),i();},e.prototype._getTokenFromIFrame=function(e){return o(this,void 0,void 0,(function(){var t,o,a,c,s,u,l,f,d,h,p,y,v,m,g,b,w;return i(this,(function(i){switch(i.label){case 0:return t=pa(ha()),o=pa(ha()),a=ha(),[4,va(a)];case 1:c=i.sent(),s=ga(c),u=r(e,["detailedResponse"]),l=this._getParams(u,t,o,s,e.redirect_uri||this.options.redirect_uri||window.location.origin),(f=this.cookieStorage.get(this.orgHintCookieName))&&!l.organization&&(l.organization=f),d=this._authorizeUrl(n(n({},l),{prompt:"none",response_mode:"web_message"})),h=e.timeoutInSeconds||this.options.authorizeTimeoutInSeconds,i.label=2;case 2:if(i.trys.push([2,6,,7]),window.crossOriginIsolated)throw new oa("login_required","The application is running in a Cross-Origin Isolated context, silently retrieving a token without refresh token is not possible.");return [4,(S=d,_=this.domainUrl,k=h,void 0===k&&(k=60),new Promise((function(e,t){var n=window.document.createElement("iframe");n.setAttribute("width","0"),n.setAttribute("height","0"),n.style.display="none";var r,o=function(){window.document.body.contains(n)&&(window.document.body.removeChild(n),window.removeEventListener("message",r,!1));},i=setTimeout((function(){t(new aa),o();}),1e3*k);r=function(n){if(n.origin==_&&n.data&&"authorization_response"===n.data.type){var a=n.source;a&&a.close(),n.data.response.error?t(oa.fromPayload(n.data.response)):e(n.data.response),clearTimeout(i),window.removeEventListener("message",r,!1),setTimeout(o,2e3);}},window.addEventListener("message",r,!1),window.document.body.appendChild(n),n.setAttribute("src",S);})))];case 3:if(p=i.sent(),t!==p.state)throw new Error("Invalid state");return y=e.scope,v=e.audience,m=r(e,["scope","audience","redirect_uri","ignoreCache","timeoutInSeconds","detailedResponse"]),[4,Ia(n(n(n({},this.customOptions),m),{scope:y,audience:v,baseUrl:this.domainUrl,client_id:this.options.client_id,code_verifier:a,code:p.code,grant_type:"authorization_code",redirect_uri:l.redirect_uri,auth0Client:this.options.auth0Client,useFormData:this.options.useFormData}),this.worker)];case 4:return g=i.sent(),[4,this._verifyIdToken(g.id_token,o)];case 5:return b=i.sent(),this._processOrgIdHint(b.claims.org_id),[2,n(n({},g),{decodedToken:b,scope:l.scope,oauthTokenScope:g.scope,audience:l.audience||"default"})];case 6:throw "login_required"===(w=i.sent()).error&&this.logout({localOnly:!0}),w;case 7:return [2]}var S,_,k;}))}))},e.prototype._getTokenUsingRefreshToken=function(e){return o(this,void 0,void 0,(function(){var t,o,a,c,s,u,l,f,d;return i(this,(function(i){switch(i.label){case 0:return e.scope=Oa(this.defaultScope,this.options.scope,e.scope),[4,this.cacheManager.get(new Ea({scope:e.scope,audience:e.audience||"default",client_id:this.options.client_id}))];case 1:return (t=i.sent())&&t.refresh_token||this.worker?[3,3]:[4,this._getTokenFromIFrame(e)];case 2:return [2,i.sent()];case 3:o=e.redirect_uri||this.options.redirect_uri||window.location.origin,c=e.scope,s=e.audience,u=r(e,["scope","audience","ignoreCache","timeoutInSeconds","detailedResponse"]),l="number"==typeof e.timeoutInSeconds?1e3*e.timeoutInSeconds:null,i.label=4;case 4:return i.trys.push([4,6,,9]),[4,Ia(n(n(n(n(n({},this.customOptions),u),{audience:s,scope:c,baseUrl:this.domainUrl,client_id:this.options.client_id,grant_type:"refresh_token",refresh_token:t&&t.refresh_token,redirect_uri:o}),l&&{timeout:l}),{auth0Client:this.options.auth0Client,useFormData:this.options.useFormData}),this.worker)];case 5:return a=i.sent(),[3,9];case 6:return "The web worker is missing the refresh token"===(f=i.sent()).message||f.message&&f.message.indexOf("invalid refresh token")>-1?[4,this._getTokenFromIFrame(e)]:[3,8];case 7:return [2,i.sent()];case 8:throw f;case 9:return [4,this._verifyIdToken(a.id_token)];case 10:return d=i.sent(),[2,n(n({},a),{decodedToken:d,scope:e.scope,oauthTokenScope:a.scope,audience:e.audience||"default"})]}}))}))},e.prototype._getEntryFromCache=function(e){var t=e.scope,r=e.audience,a=e.client_id,c=e.getDetailedEntry,s=void 0!==c&&c;return o(this,void 0,void 0,(function(){var e,o,c,u,l;return i(this,(function(i){switch(i.label){case 0:return [4,this.cacheManager.get(new Ea({scope:t,audience:r,client_id:a}),60)];case 1:return (e=i.sent())&&e.access_token?s?(o=e.id_token,c=e.access_token,u=e.oauthTokenScope,l=e.expires_in,[2,n(n({id_token:o,access_token:c},u?{scope:u}:null),{expires_in:l})]):[2,e.access_token]:[2]}}))}))},e}();function nc(e){return o(this,void 0,void 0,(function(){var t;return i(this,(function(n){switch(n.label){case 0:return [4,(t=new ec(e)).checkSession()];case 1:return n.sent(),[2,t]}}))}))}

    const config = {
        domain: "dev-abo1i4dg.us.auth0.com",
        clientId: "BltqLYYrutovy9QhZpAG7rbUInR8w752"
      };

    async function createClient() {
      let auth0Client = await nc({
        domain: config.domain,
        client_id: config.clientId,
      });

      return auth0Client;
    }

    async function loginWithPopup(client, options) {
      popupOpen.set(true);
      try {
        await client.loginWithPopup(options);
        user.set(await client.getUser());
        isAuthenticated.set(true);
        const accessToken = await client.getIdTokenClaims();
        if (accessToken) {
          token.set(accessToken.__raw);
        }
      } catch (e) {
        // eslint-disable-next-line
        console.error(e);
      } finally {
        popupOpen.set(false);
      }
    }

    function logout(client) {
      return client.logout();
    }

    const auth = {
      createClient,
      loginWithPopup,
      logout,
    };

    /* src/App.svelte generated by Svelte v3.44.3 */
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    // (104:2) {:else}
    function create_else_block(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Login";
    			attr_dev(button, "class", "btn svelte-rnl8q5");
    			add_location(button, file, 104, 4, 3209);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*login*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(104:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (68:2) {#if $isAuthenticated}
    function create_if_block(ctx) {
    	let div9;
    	let div8;
    	let div7;
    	let div5;
    	let div4;
    	let div0;
    	let t1;
    	let div1;
    	let t3;
    	let div2;
    	let t5;
    	let div3;
    	let t7;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t8;
    	let div6;
    	let button0;
    	let t10;
    	let button1;
    	let t12;
    	let button2;
    	let mounted;
    	let dispose;
    	let each_value = /*$notes*/ ctx[1];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*note*/ ctx[7].id;
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			div9 = element("div");
    			div8 = element("div");
    			div7 = element("div");
    			div5 = element("div");
    			div4 = element("div");
    			div0 = element("div");
    			div0.textContent = "№";
    			t1 = space();
    			div1 = element("div");
    			div1.textContent = "Title";
    			t3 = space();
    			div2 = element("div");
    			div2.textContent = "Date";
    			t5 = space();
    			div3 = element("div");
    			div3.textContent = "Status";
    			t7 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t8 = space();
    			div6 = element("div");
    			button0 = element("button");
    			button0.textContent = "Add Note";
    			t10 = space();
    			button1 = element("button");
    			button1.textContent = "Delete";
    			t12 = space();
    			button2 = element("button");
    			button2.textContent = "Logout";
    			attr_dev(div0, "class", "cell svelte-rnl8q5");
    			add_location(div0, file, 73, 14, 2129);
    			attr_dev(div1, "class", "cell svelte-rnl8q5");
    			add_location(div1, file, 74, 14, 2169);
    			attr_dev(div2, "class", "cell svelte-rnl8q5");
    			add_location(div2, file, 75, 14, 2213);
    			attr_dev(div3, "class", "cell svelte-rnl8q5");
    			add_location(div3, file, 76, 14, 2256);
    			attr_dev(div4, "class", "row header svelte-rnl8q5");
    			add_location(div4, file, 72, 12, 2090);
    			attr_dev(div5, "class", "table svelte-rnl8q5");
    			add_location(div5, file, 71, 10, 2058);
    			attr_dev(button0, "class", "btn svelte-rnl8q5");
    			add_location(button0, file, 96, 12, 2946);
    			attr_dev(button1, "class", "btn svelte-rnl8q5");
    			add_location(button1, file, 97, 12, 3015);
    			attr_dev(button2, "class", "btn svelte-rnl8q5");
    			add_location(button2, file, 98, 12, 3085);
    			attr_dev(div6, "class", "buttons svelte-rnl8q5");
    			add_location(div6, file, 95, 10, 2912);
    			attr_dev(div7, "class", "wrap-table100 svelte-rnl8q5");
    			add_location(div7, file, 70, 8, 2020);
    			attr_dev(div8, "class", "container-table100 svelte-rnl8q5");
    			add_location(div8, file, 69, 6, 1979);
    			attr_dev(div9, "class", "limiter svelte-rnl8q5");
    			add_location(div9, file, 68, 4, 1951);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div9, anchor);
    			append_dev(div9, div8);
    			append_dev(div8, div7);
    			append_dev(div7, div5);
    			append_dev(div5, div4);
    			append_dev(div4, div0);
    			append_dev(div4, t1);
    			append_dev(div4, div1);
    			append_dev(div4, t3);
    			append_dev(div4, div2);
    			append_dev(div4, t5);
    			append_dev(div4, div3);
    			append_dev(div5, t7);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div5, null);
    			}

    			append_dev(div7, t8);
    			append_dev(div7, div6);
    			append_dev(div6, button0);
    			append_dev(div6, t10);
    			append_dev(div6, button1);
    			append_dev(div6, t12);
    			append_dev(div6, button2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*addNote*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*deleteNote*/ ctx[5], false, false, false),
    					listen_dev(button2, "click", /*logout*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$notes, dateDisplay*/ 2) {
    				each_value = /*$notes*/ ctx[1];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div5, destroy_block, create_each_block, null, get_each_context);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div9);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(68:2) {#if $isAuthenticated}",
    		ctx
    	});

    	return block;
    }

    // (79:12) {#each $notes as note (note.id)}
    function create_each_block(key_1, ctx) {
    	let div4;
    	let div0;
    	let t0_value = /*note*/ ctx[7].number + "";
    	let t0;
    	let t1;
    	let div1;
    	let t2_value = /*note*/ ctx[7].note_title + "";
    	let t2;
    	let t3;
    	let div2;
    	let t4_value = dateDisplay(/*note*/ ctx[7].creation_time) + "";
    	let t4;
    	let t5;
    	let div3;
    	let t6_value = /*note*/ ctx[7].status + "";
    	let t6;
    	let t7;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			div4 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			div2 = element("div");
    			t4 = text(t4_value);
    			t5 = space();
    			div3 = element("div");
    			t6 = text(t6_value);
    			t7 = space();
    			attr_dev(div0, "class", "cell svelte-rnl8q5");
    			attr_dev(div0, "data-title", "Number");
    			add_location(div0, file, 80, 16, 2399);
    			attr_dev(div1, "class", "cell svelte-rnl8q5");
    			attr_dev(div1, "data-title", "Title");
    			add_location(div1, file, 83, 16, 2509);
    			attr_dev(div2, "class", "cell svelte-rnl8q5");
    			attr_dev(div2, "data-title", "Date");
    			add_location(div2, file, 86, 16, 2622);
    			attr_dev(div3, "class", "cell svelte-rnl8q5");
    			attr_dev(div3, "data-title", "Status");
    			add_location(div3, file, 89, 16, 2750);
    			attr_dev(div4, "class", "row svelte-rnl8q5");
    			add_location(div4, file, 79, 14, 2365);
    			this.first = div4;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div0);
    			append_dev(div0, t0);
    			append_dev(div4, t1);
    			append_dev(div4, div1);
    			append_dev(div1, t2);
    			append_dev(div4, t3);
    			append_dev(div4, div2);
    			append_dev(div2, t4);
    			append_dev(div4, t5);
    			append_dev(div4, div3);
    			append_dev(div3, t6);
    			append_dev(div4, t7);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*$notes*/ 2 && t0_value !== (t0_value = /*note*/ ctx[7].number + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*$notes*/ 2 && t2_value !== (t2_value = /*note*/ ctx[7].note_title + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*$notes*/ 2 && t4_value !== (t4_value = dateDisplay(/*note*/ ctx[7].creation_time) + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*$notes*/ 2 && t6_value !== (t6_value = /*note*/ ctx[7].status + "")) set_data_dev(t6, t6_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(79:12) {#each $notes as note (note.id)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;

    	function select_block_type(ctx, dirty) {
    		if (/*$isAuthenticated*/ ctx[0]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if_block.c();
    			add_location(main, file, 66, 0, 1915);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if_block.m(main, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(main, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_block.d();
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

    function dateDisplay(d) {
    	var datePart = d.substr(0, d.indexOf("T"));
    	var timePart = d.substr(d.indexOf("T") + 1, 5);
    	return datePart + " " + timePart;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $isAuthenticated;
    	let $notes;
    	validate_store(isAuthenticated, 'isAuthenticated');
    	component_subscribe($$self, isAuthenticated, $$value => $$invalidate(0, $isAuthenticated = $$value));
    	validate_store(notes, 'notes');
    	component_subscribe($$self, notes, $$value => $$invalidate(1, $notes = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let auth0Client;

    	onMount(async () => {
    		auth0Client = await auth.createClient();
    		isAuthenticated.set(await auth0Client.isAuthenticated());
    		user.set(await auth0Client.getUser());

    		if (isAuthenticated) {
    			const accessToken = await auth0Client.getIdTokenClaims();
    			if (accessToken) token.set(accessToken.__raw);
    		}
    	});

    	token.subscribe(async value => {
    		if (value) {
    			const result = await requestRunner.startFetchMyQuery(OperationsDocsHelper.QUERY_GetAll());
    			notes.set(result.notes_notes);
    		}
    	});

    	function login() {
    		auth.loginWithPopup(auth0Client);
    	}

    	function logout() {
    		auth.logout(auth0Client);
    	}

    	const addNote = async () => {
    		const title = prompt("Note title") ?? "";
    		const status = prompt("Task status") ?? "";
    		if (title === "") return;
    		const { insert_notes_notes } = await requestRunner.startExecuteMyMutation(OperationsDocsHelper.MUTATION_InsertOne(title, status));
    		notes.update(newNote => [...newNote, insert_notes_notes.returning[0]]);
    	};

    	const deleteNote = async () => {
    		const noteNumber = prompt("Notes' number to be deleted: " );
    		await requestRunner.startExecuteMyMutation(OperationsDocsHelper.MUTATION_DeleteByNumber(), { number: parseInt(noteNumber) });
    		notes.update(deletedNote => deletedNote.filter(item => item.number != noteNumber));
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		requestRunner,
    		OperationsDocsHelper,
    		onMount,
    		isAuthenticated,
    		user,
    		notes,
    		token,
    		auth,
    		auth0Client,
    		login,
    		logout,
    		addNote,
    		deleteNote,
    		dateDisplay,
    		$isAuthenticated,
    		$notes
    	});

    	$$self.$inject_state = $$props => {
    		if ('auth0Client' in $$props) auth0Client = $$props.auth0Client;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [$isAuthenticated, $notes, login, logout, addNote, deleteNote];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
      target: document.body,
      props: {
        name: 'world',
      },
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map