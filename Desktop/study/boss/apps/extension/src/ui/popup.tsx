import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ExtensionState } from '../storage/state';
import { sendRuntimeMessage } from './runtime';
import './styles.css';

function PopupApp() {
  const [state, setState] = useState<ExtensionState | undefined>();
  const [message, setMessage] = useState('');

  useEffect(() => {
    sendRuntimeMessage({ type: 'GET_STATE' }).then((response) => {
      if (response.ok) setState(response.state);
      else setMessage(response.error);
    });
  }, []);

  async function scan() {
    const response = await sendRuntimeMessage({ type: 'SCAN_ACTIVE_TAB' });
    setMessage(response.ok ? response.message ?? '已扫描' : response.error);
  }

  async function openPanel() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
  }

  return (
    <main className="app">
      <section className="card">
        <h1>Job Assistant</h1>
        <p className="muted">岗位：{state?.jobs.length ?? 0} · 队列：{state?.queue.items.length ?? 0}</p>
        <div className="row">
          <button onClick={scan}>扫描当前页</button>
          <button className="secondary" onClick={openPanel}>打开侧边栏</button>
        </div>
        {message && <p className="muted">{message}</p>}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<PopupApp />);
