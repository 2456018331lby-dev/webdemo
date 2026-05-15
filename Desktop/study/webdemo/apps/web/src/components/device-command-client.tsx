"use client";

import { useEffect, useState } from "react";
import { CommandHistoryList } from "./command-history-list";
import { DeviceControlPanel } from "./device-control-panel";

type CommandHistoryEntry = {
  commandId: string;
  commandType: string;
  status: string;
  requestedAt: string;
};

type DeviceCommandClientProps = {
  deviceId: string;
  deviceName: string;
  initialRelayOn: boolean;
  isOffline: boolean;
};

export function DeviceCommandClient({
  deviceId,
  deviceName,
  initialRelayOn,
  isOffline
}: DeviceCommandClientProps) {
  const [relayOn, setRelayOn] = useState(initialRelayOn);
  const [offline, setOffline] = useState(isOffline);
  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);
  const [telemetryNote, setTelemetryNote] = useState("Loading device state...");

  useEffect(() => {
    let active = true;

    async function loadSnapshot() {
      const response = await fetch(`/api/devices/${deviceId}/commands`, {
        cache: "no-store"
      });

      if (!response.ok || !active) {
        return;
      }

      const payload = await response.json();

      if (!active) {
        return;
      }

      setRelayOn(Boolean(payload.state?.relayOn));
      setOffline(!Boolean(payload.state?.online));
      setTelemetryNote(payload.state?.lastTelemetry ?? "No telemetry yet");
      setHistory(payload.commandHistory ?? []);
    }

    void loadSnapshot();

    return () => {
      active = false;
    };
  }, [deviceId]);

  return (
    <div style={{ display: "grid", gap: "22px" }}>
      <DeviceControlPanel
        deviceName={deviceName}
        initialRelayOn={relayOn}
        isOffline={offline}
        onSendRelayCommand={async (nextValue) => {
          const response = await fetch(`/api/devices/${deviceId}/commands`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              commandType: "relay.set",
              correlationId: crypto.randomUUID(),
              payload: {
                channel: 1,
                value: nextValue
              }
            })
          });

          if (!response.ok) {
            throw new Error("Command request failed");
          }

          const payload = await response.json();

          setRelayOn(Boolean(payload.state?.relayOn));
          setOffline(!Boolean(payload.state?.online));
          setTelemetryNote(payload.state?.lastTelemetry ?? "No telemetry yet");
          setHistory(payload.commandHistory ?? []);
        }}
      />
      <CommandHistoryList telemetryNote={telemetryNote} history={history} />
    </div>
  );
}
