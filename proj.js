/* Student Task Manager - vanilla JavaScript, no build step. */
(function () {
  'use strict';

  var STORAGE_KEY = 'studentTaskManager.tasks.v1';
  var state = { tasks: [], filter: 'all', query: '', editingId: null, pendingConfirm: null };
  var $ = function (id) { return document.getElementById(id); };
  var els = {};

  var ICONS = {
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>'
  };

  /* ---------- Dates ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayString() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function formatDate(str) {
    var p = str.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function isOverdue(task) {
    return !task.completed && !!task.dueDate && task.dueDate < todayString();
  }

  /* ---------- Storage ---------- */
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function isValidTask(t) {
    return t && typeof t === 'object' && typeof t.id === 'string' && typeof t.title === 'string' && t.title.trim() !== '';
  }
  function normalizeTask(t) {
    return {
      id: t.id,
      title: t.title,
      description: typeof t.description === 'string' ? t.description : '',
      category: typeof t.category === 'string' ? t.category : 'Study',
      priority: ['Low', 'Medium', 'High'].indexOf(t.priority) >= 0 ? t.priority : 'Medium',
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate || '') ? t.dueDate : '',
      completed: t.completed === true,
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now()
    };
  }
  function sampleTasks() {
    var now = Date.now();
    return [
      { title: 'Revise chapter 3 notes', description: 'Focus on the worked examples.', category: 'Study', priority: 'Medium', dueDate: '', completed: false },
      { title: 'Submit lab report', description: 'Add the graphs and references.', category: 'Assignment', priority: 'High', dueDate: '', completed: false },
      { title: 'Plan weekend revision', description: '', category: 'Personal', priority: 'Low', dueDate: '', completed: true }
    ].map(function (t, i) { t.id = newId(); t.createdAt = now - i * 1000; return t; });
  }
  function loadTasks() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return sampleTasks(); }
    if (raw === null) return sampleTasks();
    try {
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(isValidTask).map(normalizeTask);
    } catch (e) {
      console.warn('Saved tasks could not be read; starting empty.');
      return [];
    }
  }
  function saveTasks() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks)); }
    catch (e) { toast('Could not save. Browser storage may be disabled.', true); }
  }

  /* ---------- Derived data ---------- */
  function getStats() {
    var total = state.tasks.length;
    var done = state.tasks.filter(function (t) { return t.completed; }).length;
    var overdue = state.tasks.reduce(function (n, t) { return n + (isOverdue(t) ? 1 : 0); }, 0);
    return { total: total, done: done, pending: total - done, overdue: overdue, percent: total === 0 ? 0 : Math.round(done / total * 100) };
  }
  function matchesQuery(task, q) {
    if (!q) return true;
    return [task.title, task.description, task.category].join(' ').toLowerCase().indexOf(q) >= 0;
  }
  function getVisibleTasks() {
    var q = state.query.trim().toLowerCase();
    var PRI = { High: 0, Medium: 1, Low: 2 };
    return state.tasks.filter(function (t) {
      var okStatus = state.filter === 'all' || (state.filter === 'completed' ? t.completed : !t.completed);
      return okStatus && matchesQuery(t, q);
    }).sort(function (a, b) {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.dueDate !== b.dueDate) {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate < b.dueDate ? -1 : 1;
      }
      if (PRI[a.priority] !== PRI[b.priority]) return PRI[a.priority] - PRI[b.priority];
      return b.createdAt - a.createdAt;
    });
  }

  /* ---------- Rendering ---------- */
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function chip(cls, text, icon) {
    var c = h('span', 'chip ' + cls);
    if (icon) c.insertAdjacentHTML('beforeend', icon);
    c.appendChild(document.createTextNode(text));
    return c;
  }
  function iconButton(action, label, icon, extra) {
    var b = h('button', 'icon-btn' + (extra ? ' ' + extra : ''));
    b.type = 'button';
    b.dataset.action = action;
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = icon;
    return b;
  }
  function buildTask(task) {
    var li = h('li', 'task' + (task.completed ? ' is-done' : ''));
    li.dataset.id = task.id;

    var check = h('button', 'check');
    check.type = 'button';
    check.dataset.action = 'toggle';
    check.setAttribute('role', 'checkbox');
    check.setAttribute('aria-checked', String(task.completed));
    check.setAttribute('aria-label', (task.completed ? 'Mark as pending: ' : 'Mark as completed: ') + task.title);
    check.innerHTML = ICONS.check;

    var body = h('div', 'task-body');
    body.appendChild(h('p', 'task-title', task.title));
    if (task.description) body.appendChild(h('p', 'task-desc', task.description));
    var meta = h('div', 'meta');
    meta.appendChild(chip('cat', task.category));
    meta.appendChild(chip('p-' + task.priority.toLowerCase(), task.priority + ' priority'));
    if (task.dueDate) {
      meta.appendChild(isOverdue(task)
        ? chip('overdue', 'Overdue · ' + formatDate(task.dueDate), ICONS.cal)
        : chip('', 'Due ' + formatDate(task.dueDate), ICONS.cal));
    }
    body.appendChild(meta);

    var actions = h('div', 'task-actions');
    actions.appendChild(iconButton('edit', 'Edit ' + task.title, ICONS.edit));
    actions.appendChild(iconButton('delete', 'Delete ' + task.title, ICONS.trash, 'danger'));

    li.appendChild(check); li.appendChild(body); li.appendChild(actions);
    return li;
  }
  function renderTasks() {
    var visible = getVisibleTasks();
    els.list.replaceChildren.apply(els.list, visible.map(buildTask));
    var empty = visible.length === 0;
    els.empty.hidden = !empty;
    if (empty) {
      var searching = state.query.trim() !== '' || state.filter !== 'all';
      if (state.tasks.length === 0) {
        els.emptyTitle.textContent = 'No tasks yet';
        els.emptyText.textContent = 'Use Add task to create your first one.';
      } else if (searching) {
        els.emptyTitle.textContent = 'Nothing matches';
        els.emptyText.textContent = 'Try a different search or switch the filter to All.';
      }
    }
  }
  function renderStats() {
    var s = getStats();
    els.statTotal.textContent = s.total;
    els.statPending.textContent = s.pending;
    els.statDone.textContent = s.done;
    els.statOverdue.textContent = s.overdue;
    els.statOverdue.parentNode.classList.toggle('has-overdue', s.overdue > 0);
    els.countAll.textContent = s.total;
    els.countPending.textContent = s.pending;
    els.countCompleted.textContent = s.done;
    els.progressText.textContent = s.percent + '%';
    els.progressFill.style.width = s.percent + '%';
    els.progressBar.setAttribute('aria-valuenow', String(s.percent));
    els.motivation.textContent = motivationFor(s);
  }
  function motivationFor(s) {
    var hour = new Date().getHours();
    var part = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
    if (s.total === 0) return part + ' Add a task to start your list.';
    if (s.pending === 0) return part + ' Everything is done. Enjoy the rest of your day.';
    if (s.overdue > 0) return part + ' Start with the overdue task' + (s.overdue > 1 ? 's' : '') + ', then the rest will feel lighter.';
    if (s.percent >= 50) return part + ' You are past halfway. ' + s.pending + ' to go.';
    return part + ' One small task is a good place to begin.';
  }
  function render() { renderStats(); renderTasks(); }

  /* ---------- Toasts ---------- */
  function toast(message, isError) {
    var t = h('div', 'toast' + (isError ? ' error' : ''), message);
    els.toasts.appendChild(t);
    setTimeout(function () {
      t.classList.add('leave');
      setTimeout(function () { t.remove(); }, 240);
    }, 2400);
  }

  /* ---------- Dialogs ---------- */
  function openDialog(dlg) {
    if (!dlg.open) dlg.showModal();
    requestAnimationFrame(function () { dlg.classList.add('is-open'); });
  }
  function closeDialog(dlg) {
    if (!dlg.open) return;
    dlg.classList.remove('is-open');
    setTimeout(function () { if (dlg.open) dlg.close(); }, 200);
  }
  function openTaskForm(task) {
    state.editingId = task ? task.id : null;
    $('taskDialogTitle').textContent = task ? 'Edit task' : 'Add task';
    els.saveBtn.textContent = task ? 'Save changes' : 'Add task';
    els.form.reset();
    $('fTitle').value = task ? task.title : '';
    $('fDesc').value = task ? task.description : '';
    $('fCategory').value = task ? task.category : 'Study';
    $('fPriority').value = task ? task.priority : 'Medium';
    $('fDue').value = task ? task.dueDate : '';
    showTitleError(false);
    openDialog(els.taskDialog);
    $('fTitle').focus();
  }
  function showTitleError(on) {
    els.titleError.hidden = !on;
    $('fTitle').closest('.field').classList.toggle('invalid', on);
    $('fTitle').setAttribute('aria-invalid', String(on));
  }
  function askConfirm(title, text, okLabel, onOk) {
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = text;
    els.confirmOk.textContent = okLabel;
    state.pendingConfirm = onOk;
    openDialog(els.confirmDialog);
    els.confirmOk.focus();
  }

  /* ---------- Task actions ---------- */
  function findTask(id) { return state.tasks.find(function (t) { return t.id === id; }); }
  function submitForm(e) {
    e.preventDefault();
    var title = $('fTitle').value.trim();
    if (!title) { showTitleError(true); $('fTitle').focus(); toast('A title is required.', true); return; }
    var data = {
      title: title,
      description: $('fDesc').value.trim(),
      category: $('fCategory').value,
      priority: $('fPriority').value,
      dueDate: $('fDue').value
    };
    if (state.editingId) {
      var task = findTask(state.editingId);
      if (task) { Object.assign(task, data); toast('Task updated'); }
    } else {
      state.tasks.push(Object.assign({ id: newId(), completed: false, createdAt: Date.now() }, data));
      toast('Task added');
    }
    saveTasks(); render(); closeDialog(els.taskDialog);
  }
  function toggleTask(id) {
    var task = findTask(id);
    if (!task) return;
    task.completed = !task.completed;
    saveTasks(); render();
    toast(task.completed ? 'Task completed' : 'Task moved back to pending');
  }
  function deleteTask(id) {
    state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
    saveTasks(); render(); toast('Task deleted');
  }
  function clearCompleted() {
    var n = getStats().done;
    if (n === 0) { toast('No completed tasks to clear.'); return; }
    askConfirm('Clear completed tasks?', n + (n === 1 ? ' completed task' : ' completed tasks') + ' will be removed.', 'Clear', function () {
      state.tasks = state.tasks.filter(function (t) { return !t.completed; });
      saveTasks(); render(); toast('Completed tasks cleared');
    });
  }
  function setFilter(f) {
    state.filter = f;
    document.querySelectorAll('.tab').forEach(function (b) {
      var on = b.dataset.filter === f;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    renderTasks();
  }

  /* ---------- Events ---------- */
  function bindEvents() {
    $('addTaskBtn').addEventListener('click', function () { openTaskForm(null); });
    els.form.addEventListener('submit', submitForm);
    $('fTitle').addEventListener('input', function () { if ($('fTitle').value.trim()) showTitleError(false); });
    els.search.addEventListener('input', function () { state.query = els.search.value; renderTasks(); });
    document.querySelector('.tabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (b) setFilter(b.dataset.filter);
    });
    $('clearCompletedBtn').addEventListener('click', clearCompleted);

    els.list.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var li = btn.closest('.task');
      var task = li && findTask(li.dataset.id);
      if (!task) return;
      if (btn.dataset.action === 'toggle') toggleTask(task.id);
      else if (btn.dataset.action === 'edit') openTaskForm(task);
      else if (btn.dataset.action === 'delete') {
        askConfirm('Delete task?', '"' + task.title + '" will be removed permanently.', 'Delete', function () { deleteTask(task.id); });
      }
    });

    els.confirmOk.addEventListener('click', function () {
      var fn = state.pendingConfirm; state.pendingConfirm = null;
      closeDialog(els.confirmDialog);
      if (fn) fn();
    });
    document.querySelectorAll('dialog').forEach(function (dlg) {
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); closeDialog(dlg); });
      dlg.addEventListener('click', function (e) {
        var r = dlg.getBoundingClientRect();
        var outside = e.target === dlg && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
        if (outside || e.target.closest('[data-close]')) closeDialog(dlg);
      });
    });
  }

  /* ---------- Hover tilt (CSS 3D transforms, no animation loop) ---------- */
  function initTilt() {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var touch = window.matchMedia('(hover: none)').matches;
    if (reduce || touch) return;
    document.querySelectorAll('[data-tilt]').forEach(function (el) {
      var max = el.classList.contains('stat') ? 5 : 7;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        el.classList.add('is-tilting');
        el.style.setProperty('--ry', (x * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (-y * max * 2).toFixed(2) + 'deg');
      });
      el.addEventListener('pointerleave', function () {
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ---------- Three.js: one small shared canvas, renders only while moving ---------- */
  function initOrb() {
    var canvas = $('orb');
    if (!canvas || typeof THREE === 'undefined') { if (canvas) canvas.hidden = true; return; }
    try {
      var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(120, 120, false);
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
      camera.position.z = 4.2;
      var group = new THREE.Group();
      group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), new THREE.MeshBasicMaterial({ color: 0xFBF3D4 })));
      group.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.2, 1)), new THREE.LineBasicMaterial({ color: 0xD9B84A })));
      group.rotation.set(0.4, 0.6, 0);
      scene.add(group);
      var target = { x: 0.4, y: 0.6 }, running = false;
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function frame() {
        var dx = target.x - group.rotation.x, dy = target.y - group.rotation.y;
        group.rotation.x += dx * 0.12; group.rotation.y += dy * 0.12;
        renderer.render(scene, camera);
        if (Math.abs(dx) + Math.abs(dy) > 0.002) requestAnimationFrame(frame); else running = false;
      }
      function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }
      renderer.render(scene, camera);
      if (reduce || window.matchMedia('(hover: none)').matches) return;
      window.addEventListener('pointermove', function (e) {
        target.y = 0.6 + (e.clientX / window.innerWidth - 0.5) * 2.2;
        target.x = 0.4 + (e.clientY / window.innerHeight - 0.5) * 1.6;
        kick();
      }, { passive: true });
    } catch (err) {
      canvas.hidden = true;
    }
  }

  /* ---------- Init ---------- */
  function init() {
    ['taskList', 'emptyState', 'emptyTitle', 'emptyText', 'searchInput', 'taskForm', 'taskDialog', 'confirmDialog', 'confirmOk', 'saveBtn', 'titleError', 'toasts',
     'statTotal', 'statPending', 'statDone', 'statOverdue', 'countAll', 'countPending', 'countCompleted', 'progressText', 'progressFill', 'progressBar', 'motivation']
      .forEach(function (id) { els[id] = $(id); });
    els.list = els.taskList; els.empty = els.emptyState; els.search = els.searchInput; els.form = els.taskForm;
    $('todayLabel').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    state.tasks = loadTasks();
    saveTasks();
    bindEvents();
    render();
    initTilt();
    initOrb();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
