(() => {
  const ownedSelector =
    "[data-fsd-alert],[data-fsd-warning],[data-fsd-flag],[data-fsd-chat-flag],[data-fsd-previous],[data-fsd-draft-warning]";

  function selector() {
    return (
      globalThis.fsdMessageDetector?.candidateSelector ||
      '[data-testid="message"],[data-testid="message-bubble"],[data-message-id],[class*="message-bubble" i],[class*="messageBubble"],[class*="conversation-message" i]'
    );
  }

  function visibleRoot() {
    const root =
      globalThis.fsdConversationDetector?.conversationRoot?.() ||
      document.querySelector('main,[role="main"]');
    return root && root !== document.body ? root : null;
  }

  function elementsFrom(node, candidateSelector) {
    if (!(node instanceof Element)) return [];
    if (node.closest(ownedSelector)) return [];
    const directSelector =
      '[data-testid="message"],[data-testid="message-bubble"],[data-message-id],[class*="message-bubble" i],[class*="messageBubble"],[class*="conversation-message" i],[role="listitem"],p,[dir="auto"],[aria-label*="message" i]';
    const elements = node.matches(directSelector) ? [node] : [];
    elements.push(...node.querySelectorAll(candidateSelector));
    return elements;
  }

  function create({ onMessageAdded, onMessageRemoved, debounceMs = 100 } = {}) {
    const known = new Map();
    const pendingAdded = new Set();
    const pendingRemoved = new Set();
    let root;
    let rootParent;
    let observer;
    let parentObserver;
    let timer;
    let rebindTimer;
    let routeListener;
    let historyMethods;
    let running = false;

    function remember(element) {
      const message = globalThis.fsdMessageExtractor?.extractMessage?.(element);
      if (!message) return null;
      known.set(element, message);
      return message;
    }

    function queueAdded(node) {
      for (const element of elementsFrom(node, selector()))
        pendingAdded.add(element);
    }

    function queueRemoved(node) {
      if (!(node instanceof Element)) return;
      if (node.matches(ownedSelector)) return;
      const direct = known.get(node);
      if (direct) pendingRemoved.add(direct);
      // Detached nodes no longer match selectors anchored to body/main.
      for (const element of node.querySelectorAll("*")) {
        const message = known.get(element);
        if (message) pendingRemoved.add(message);
      }
    }

    function flush() {
      timer = undefined;
      const added = [...pendingAdded];
      const removed = [...pendingRemoved];
      pendingAdded.clear();
      pendingRemoved.clear();
      const emitted = new Set();
      for (const element of added) {
        if (!element.isConnected) continue;
        const message = remember(element);
        if (!message || emitted.has(element)) continue;
        emitted.add(element);
        onMessageAdded?.(message);
      }
      for (const message of removed) {
        const element = message.element;
        known.delete(element);
        onMessageRemoved?.(message);
      }
    }

    function schedule() {
      if (timer === undefined) timer = setTimeout(flush, debounceMs);
    }

    function rebind() {
      rebindTimer = undefined;
      if (!running) return;
      const nextRoot = visibleRoot();
      if (nextRoot === root && root?.isConnected) return;
      observer?.disconnect();
      parentObserver?.disconnect();
      // Detached conversation roots must not retain their message elements.
      for (const [element] of known)
        if (!element.isConnected) known.delete(element);
      root = nextRoot;
      rootParent = root?.parentElement;
      if (!root) return;
      observer = new MutationObserver((records) => {
        let changed = false;
        for (const record of records) {
          if (record.type !== "childList") continue;
          if (record.target.closest?.(ownedSelector)) continue;
          for (const node of record.addedNodes) {
            if (node.nodeType === 1 && node.matches(ownedSelector)) continue;
            queueAdded(node);
            changed = true;
          }
          for (const node of record.removedNodes) {
            if (node.nodeType === 1 && node.matches(ownedSelector)) continue;
            queueRemoved(node);
            changed = true;
          }
        }
        if (changed) schedule();
      });
      observer.observe(root, { childList: true, subtree: true });
      parentObserver = new MutationObserver(() => {
        if (!root?.isConnected) scheduleRebind();
      });
      if (rootParent) parentObserver.observe(rootParent, { childList: true });
      for (const element of root.querySelectorAll(selector()))
        pendingAdded.add(element);
      schedule();
    }

    function scheduleRebind() {
      if (rebindTimer === undefined) rebindTimer = setTimeout(rebind, 0);
    }

    function start() {
      if (running) return;
      running = true;
      const originalPush = history.pushState;
      const originalReplace = history.replaceState;
      const changed = () => scheduleRebind();
      history.pushState = function (...args) {
        const result = originalPush.apply(this, args);
        changed();
        return result;
      };
      history.replaceState = function (...args) {
        const result = originalReplace.apply(this, args);
        changed();
        return result;
      };
      historyMethods = {
        originalPush, originalReplace,
        wrappedPush: history.pushState, wrappedReplace: history.replaceState,
      };
      routeListener = changed;
      addEventListener("popstate", routeListener);
      rebind();
    }

    function stop() {
      running = false;
      observer?.disconnect();
      parentObserver?.disconnect();
      clearTimeout(timer);
      clearTimeout(rebindTimer);
      timer = undefined;
      rebindTimer = undefined;
      if (routeListener) removeEventListener("popstate", routeListener);
      if (historyMethods) {
        if (history.pushState === historyMethods.wrappedPush)
          history.pushState = historyMethods.originalPush;
        if (history.replaceState === historyMethods.wrappedReplace)
          history.replaceState = historyMethods.originalReplace;
      }
      root = undefined;
      rootParent = undefined;
      observer = undefined;
      parentObserver = undefined;
      historyMethods = undefined;
      routeListener = undefined;
      pendingAdded.clear();
      pendingRemoved.clear();
      known.clear();
    }

    return { start, stop, refresh: scheduleRebind };
  }

  globalThis.fsdMessageObserver = { create };
})();
