import React from 'react';

const HowTo: React.FC = () => {
  return (
    <div className="min-h-screen bg-floral-white text-black">
      <div className="container mx-auto p-4">
        <h1 className="text-4xl font-bold text-orange mt-20 text-center">How to Use RewriteLikeMe (Local App)</h1>
        <div className="mt-8 max-w-2xl mx-auto space-y-6">
          <p>
            This is the offline app for RewriteLikeMe. Everything runs on your computer. You do not create Voices here; instead, you download open-source Voices and run them locally. It's a good way to "get your feet wet" with rephrasing technology!
          </p>

          <h2 className="text-2xl font-bold text-orange">Step 1: Download the starter Voice</h2>
          <p className="mt-2">
            On first launch, the onboarding will prompt you to download a starter Voice (<span className="font-semibold">Rewritelikeme/Nietzsche</span>) and its base model (<span className="font-semibold">Rewritelikeme/mistral7bv02</span>).
          </p>

          <h2 className="text-2xl font-bold text-orange">Step 2: Let the files download</h2>
          <p className="mt-2">
            You will see progress for both the Voice and the base model. This can take a while depending on your connection and disk speed.
          </p>

          <h2 className="text-2xl font-bold text-orange">Step 3: Wake up (activate) the Voice</h2>
          <p className="mt-2">
            After both downloads complete, the app automatically activates ("wakes up") the Voice so it is ready to convert text. This may take a minute and typically needs about <span className="font-semibold">10 GB of RAM</span>.
          </p>

          <h2 className="text-2xl font-bold text-orange">Step 4: Convert text</h2>
          <p className="mt-2">
            Go to Dashboard → Convert, paste or type text, and click <span className="font-semibold">Convert</span>. The tutorial may prefill sample text the first time to help you try it quickly.
          </p>

          <h2 className="text-2xl font-bold text-orange">Step 5: Explore more Voices</h2>
          <p className="mt-2">
            Visit Dashboard → Voices to download additional open-source Voices. After a Voice is downloaded and activated, you can switch to it for conversions.
          </p>

          <h2 className="text-2xl font-bold text-orange">Optional: Make a custom Voice</h2>
          <p className="mt-2">
            Custom Voice creation is not part of the local app. If you want a Voice trained on your own writing, visit <a href="https://RewriteLikeMe.com" target="_blank" rel="noreferrer" className="text-orange underline">RewriteLikeMe.com</a> to create one.
          </p>

          <h2 className="text-2xl font-bold text-orange">Troubleshooting</h2>
          <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
            <li>
              <span className="font-semibold">Activation failed or ran out of memory:</span> Close heavy apps (Cursor, Chrome), then try again. The model often needs around 10 GB of free RAM.
            </li>
            <li>
              <span className="font-semibold">Still having trouble?</span> Restart your computer and retry. Older or very lightweight systems may struggle to run models locally.
            </li>
            <li>
              <span className="font-semibold">Other errors:</span> If the error is not about memory, please reach out via Discord or GitHub with the error details so we can fix it.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HowTo;