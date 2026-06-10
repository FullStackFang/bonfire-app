import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

const EMBER = "#f05846";
const COAL = "#231715";
const CREAM = "#fff7f1";
const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function injectPwaHeadTags() {
  const ensure = (selector: string, create: () => HTMLElement) => {
    if (!document.head.querySelector(selector)) document.head.appendChild(create());
  };
  ensure('link[rel="manifest"]', () => {
    const l = document.createElement("link");
    l.rel = "manifest";
    l.href = "/manifest.json";
    return l;
  });
  ensure('link[rel="apple-touch-icon"]', () => {
    const l = document.createElement("link");
    l.rel = "apple-touch-icon";
    l.href = "/icons/icon.png";
    return l;
  });
  ensure('meta[name="apple-mobile-web-app-capable"]', () => {
    const m = document.createElement("meta");
    m.name = "apple-mobile-web-app-capable";
    m.content = "yes";
    return m;
  });
  ensure('meta[name="apple-mobile-web-app-title"]', () => {
    const m = document.createElement("meta");
    m.name = "apple-mobile-web-app-title";
    m.content = "Bonfire";
    return m;
  });
}

export default function PushSpike() {
  const [standalone, setStandalone] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [permission, setPermission] = useState<string>("unknown");
  const [subscription, setSubscription] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const say = (m: string) => setLog((p) => [...p, m]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    injectPwaHeadTags();
    const nav = navigator as Navigator & { standalone?: boolean };
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true);
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(async (reg) => {
          setSwReady(true);
          const existing = await reg.pushManager.getSubscription();
          if (existing) setSubscription(JSON.stringify(existing.toJSON()));
        })
        .catch((e) => say(`SW register failed: ${e.message}`));
    } else {
      say("No serviceWorker in navigator");
    }
  }, []);

  const enable = () => {
    // Must run inside the tap gesture on iOS.
    if (typeof Notification === "undefined") {
      say("Notification API unavailable — open from the Home Screen icon, not a Safari tab.");
      return;
    }
    Notification.requestPermission()
      .then(async (perm) => {
        setPermission(perm);
        if (perm !== "granted") {
          say(`Permission: ${perm}`);
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        setSubscription(JSON.stringify(sub.toJSON()));
        say("Subscribed.");
      })
      .catch((e) => say(`Subscribe failed: ${e.message}`));
  };

  const copySub = async () => {
    if (!subscription) return;
    await navigator.clipboard.writeText(subscription);
    say("Copied to clipboard.");
  };

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: CREAM }}>
        <Text style={{ color: COAL }}>Web-only spike. Open the web build.</Text>
      </View>
    );
  }

  const Status = ({ label, ok }: { label: string; ok: boolean }) => (
    <Text style={{ color: COAL, fontSize: 16, marginBottom: 4 }}>
      {ok ? "✅" : "⬜"} {label}
    </Text>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: CREAM }} contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Text style={{ fontSize: 28, color: EMBER, marginBottom: 16 }}>Push spike</Text>
      <Status label="VAPID key baked into build" ok={VAPID_PUBLIC_KEY.length > 0} />
      <Status label="Running standalone (installed)" ok={standalone} />
      <Status label="Service worker registered" ok={swReady} />
      <Status label={`Notification permission: ${permission}`} ok={permission === "granted"} />
      <Status label="Push subscription active" ok={!!subscription} />

      {!standalone && (
        <Text style={{ color: COAL, marginVertical: 12 }}>
          On iPhone: tap Share → Add to Home Screen, then open Bonfire from the icon.
        </Text>
      )}

      <Pressable onPress={enable} style={{ backgroundColor: EMBER, borderRadius: 999, padding: 16, marginTop: 16, alignItems: "center" }}>
        <Text style={{ color: "#fff", fontSize: 17, fontWeight: "600" }}>Enable notifications</Text>
      </Pressable>

      {subscription && (
        <>
          <Pressable onPress={copySub} style={{ backgroundColor: COAL, borderRadius: 999, padding: 16, marginTop: 12, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 17 }}>Copy subscription JSON</Text>
          </Pressable>
          <Text selectable style={{ color: COAL, fontSize: 11, marginTop: 12, fontFamily: Platform.select({ web: "monospace" }) }}>
            {subscription}
          </Text>
        </>
      )}

      {log.map((m, i) => (
        <Text key={i} style={{ color: EMBER, marginTop: 8 }}>{m}</Text>
      ))}
    </ScrollView>
  );
}
