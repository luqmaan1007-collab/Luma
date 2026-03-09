<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script>
/* ======================
   Luma Runtime + Reconciliation
   ====================== */
const Luma = (() => {
  const isFn = x => typeof x === "function";
  const Fragment = Symbol("Fragment");

  // Scheduler
  const queue = [];
  let flushing = false;
  const schedule = fn => {
    queue.push(fn);
    if(!flushing){
      flushing = true;
      Promise.resolve().then(()=>{
        while(queue.length) queue.shift()();
        flushing = false;
      });
    }
  };

  // Hooks
  let currentComponent = null;
  const hookStore = new WeakMap();
  let hookIndex = 0;

  const useState = initial => {
    const comp = currentComponent;
    const hooks = hookStore.get(comp) || [];
    if(hooks[hookIndex] === undefined) hooks[hookIndex] = initial;
    const idx = hookIndex;
    const setState = v => {
      hooks[idx] = typeof v === "function" ? v(hooks[idx]) : v;
      schedule(() => render(comp, comp._root));
    };
    hookIndex++;
    hookStore.set(comp, hooks);
    return [hooks[idx], setState];
  };

  const useEffect = (fn,deps) => {
    const comp = currentComponent;
    const hooks = hookStore.get(comp) || [];
    if(!hooks[hookIndex] || !deps.every((d,i)=>d===hooks[hookIndex].deps[i])){
      setTimeout(fn,0);
      hooks[hookIndex] = {deps};
    }
    hookIndex++;
    hookStore.set(comp, hooks);
  };

  // DOM diffing (Reconciliation)
  const diff = (parent, newNode, oldNode, index=0) => {
    if(!oldNode){
      parent.appendChild(createDom(newNode));
    } else if(!newNode){
      parent.removeChild(parent.childNodes[index]);
    } else if(typeof newNode !== typeof oldNode ||
              (typeof newNode === "string" && newNode !== oldNode) ||
              (newNode.tag !== oldNode.tag)){
      parent.replaceChild(createDom(newNode), parent.childNodes[index]);
    } else if(newNode.tag){
      // Update props
      const domNode = parent.childNodes[index];
      const allProps = {...oldNode.props,...newNode.props};
      Object.entries(allProps).forEach(([k,v])=>{
        if(k.startsWith("on") && isFn(v)) domNode[k.toLowerCase()] = v;
        else if(k === "style" && typeof v === "object") Object.assign(domNode.style,v);
        else if(k==="className") domNode.className=v;
        else domNode.setAttribute(k,v);
      });
      const len = Math.max(newNode.children.length, oldNode.children.length);
      for(let i=0;i<len;i++){
        diff(domNode, newNode.children[i], oldNode.children[i], i);
      }
    }
  };

  // Virtual DOM
  const h = (tag, props, ...children) => ({ tag, props, children });

  const createDom = vnode => {
    if(vnode == null) return document.createTextNode("");
    if(typeof vnode !== "object") return document.createTextNode(String(vnode));
    if(Array.isArray(vnode)) {
      const frag = document.createDocumentFragment();
      vnode.forEach(c => frag.appendChild(createDom(c)));
      return frag;
    }
    if(vnode.tag === Fragment) return createDom(vnode.children);
    if(isFn(vnode.tag)){
      currentComponent = vnode.tag;
      hookIndex = 0;
      vnode._root = vnode._root || document.createElement("div");
      const el = createDom(vnode.tag({...vnode.props, children:vnode.children}));
      vnode._root.innerHTML = "";
      vnode._root.appendChild(el);
      return vnode._root;
    }
    const dom = document.createElement(vnode.tag);
    Object.entries(vnode.props||{}).forEach(([k,v])=>{
      if(k.startsWith("on") && isFn(v)) dom.addEventListener(k.slice(2).toLowerCase(),v);
      else if(k==="style" && typeof v==="object") Object.assign(dom.style,v);
      else if(k==="className") dom.className=v;
      else dom.setAttribute(k,v);
    });
    (vnode.children||[]).forEach(c=>dom.appendChild(createDom(c)));
    return dom;
  };

  const render = (comp, container) => {
    const newVNode = comp();
    if(container._vnode){
      diff(container, newVNode, container._vnode);
    } else {
      container.appendChild(createDom(newVNode));
    }
    container._vnode = newVNode;
  };

  // Store
  const store = def => {
    const state = {...def.state};
    const subs = new Set();
    const notify = ()=> subs.forEach(f=>f(state));
    const out = {...state};
    Object.entries(def.actions||{}).forEach(([k,fn])=>{
      out[k] = (...a)=>{ fn.call(state,...a); Object.assign(out,state); notify(); };
    });
    out.subscribe = f => { subs.add(f); return ()=> subs.delete(f); };
    return out;
  };

  return { Fragment, h, render, useState, useEffect, store };
})();

/* ======================
   Luma Transpiler (JSX-like)
   ====================== */
const compileLuma = code => {
  return Babel.transform(code, {
    presets: ["react"],
    plugins: ["@babel/plugin-transform-react-jsx"]
  }).code;
};

/* ======================
   Luma Loader (.luma)
   ====================== */
const loadLumaFile = async url => {
  const response = await fetch(url);
  const code = await response.text();
  const js = compileLuma(code);
  const script = document.createElement("script");
  script.type = "module";
  script.textContent = js;
  document.body.appendChild(script);
};

/* ======================
   Example App
   ====================== */
const App = () => {
  const [count,setCount] = Luma.useState(0);
  Luma.useEffect(()=> console.log("Updated count:", count), [count]);
  return Luma.h("div", {},
    Luma.h("h1", {}, `Count: ${count}`),
    Luma.h("button", {onClick: ()=>setCount(c=>c+1)}, "+"),
    Luma.h("button", {onClick: ()=>setCount(c=>c-1)}, "-")
  );
};

document.addEventListener("DOMContentLoaded", ()=>{
  const root = document.getElementById("root");
  Luma.render(App, root);
});
</script>

<div id="root"></div>
