import { MetalButton, MetalWordmark } from './MetalButton';

export default function Demo() {
  return (
    <main className="tk-metal-demo">
      <style>{`
        .tk-metal-demo { min-height: 100vh; display: grid; place-items: center; padding: 48px 20px; box-sizing: border-box;
          background: radial-gradient(90% 70% at 50% 30%, #ffffff 0%, #ececee 70%, #e2e2e6 100%); color: #18181b;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
        .tk-metal-demo__stack { display: grid; justify-items: center; gap: 28px; text-align: center; }
        .tk-metal-demo__lede { margin: 0; max-width: 420px; color: #71717a; font-size: 15px; line-height: 1.6; }
        .tk-metal-demo__row { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 18px; }
        .tk-metal-demo__ghost { height: 44px; padding: 0 20px; border-radius: 999px; border: 1px solid #d4d4d8; background: transparent; color: inherit; font: 500 14px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
        .tk-metal-demo__ghost:focus-visible { outline: 2px solid #3b6cff; outline-offset: 3px; }
        .tk-metal-demo__label { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #a1a1aa; }
        @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .tk-metal-demo { background: radial-gradient(90% 70% at 50% 30%, #1c1c20 0%, #09090b 75%); color: #fafafa; } }
        [data-theme="dark"] .tk-metal-demo { background: radial-gradient(90% 70% at 50% 30%, #1c1c20 0%, #09090b 75%); color: #fafafa; }
        @media (max-width: 480px) { .tk-metal-demo .tk-metal-word { font-size: 44px !important; } }
      `}</style>
      <div className="tk-metal-demo__stack">
        <span className="tk-metal-demo__label">Wordmark</span>
        <MetalWordmark font="700 72px/1 ui-sans-serif, system-ui, sans-serif">Northwind</MetalWordmark>
        <p className="tk-metal-demo__lede">A liquid chrome ring that follows the button's shape, and a wordmark filled with the same moving metal.</p>
        <div className="tk-metal-demo__row">
          <MetalButton preset="chromatic">Start free trial</MetalButton>
          <MetalButton preset="silver" icon={null}>Book a demo</MetalButton>
          <MetalButton preset="gold" shape="circle" aria-label="Generate" />
        </div>
        <button className="tk-metal-demo__ghost" type="button">See pricing</button>
      </div>
    </main>
  );
}
