// Wraps a route in an iPhone-shaped bezel via an <iframe>, so it can be
// reviewed as "what it'll look like on the phone" from any desktop browser.
// Purely a preview aid — has no effect on the real native app.
export default function PhoneFramePreview({ src }: { src: string }) {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#0a0a0a] py-10">
      <div
        className="relative rounded-[52px] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
        style={{ background: '#111214', width: 406, height: 860 }}
      >
        {/* Side buttons */}
        <div className="absolute -left-[3px] top-[130px] w-[3px] h-8 bg-[#0a0a0a] rounded-l" />
        <div className="absolute -left-[3px] top-[180px] w-[3px] h-14 bg-[#0a0a0a] rounded-l" />
        <div className="absolute -left-[3px] top-[250px] w-[3px] h-14 bg-[#0a0a0a] rounded-l" />
        <div className="absolute -right-[3px] top-[200px] w-[3px] h-20 bg-[#0a0a0a] rounded-r" />

        <div className="relative w-full h-full rounded-[40px] overflow-hidden bg-black">
          {/* Dynamic island */}
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-20" />
          <iframe
            src={src}
            title="Mawq3i preview"
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
