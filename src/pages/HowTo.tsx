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

          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <p className="text-sm italic">
              An AI that can rephrase text from one style into another is called a "Voice". The RewriteLikeMe app has a number of open-source voices you can pick from.
            </p>
          </div>

          <h2 className="text-2xl font-bold text-orange">Step 1: Find and Download Voices</h2>
          <p className="mt-2">
            Go to Dashboard → Voices to browse available open-source Voices. Each Voice represents a different writing style (like Nietzsche, Shakespeare, etc.). Click "Download" on any Voice you want to use. The app will download both the Voice and its required base model.
          </p>

          <h2 className="text-2xl font-bold text-orange">Step 2: Activate ("Wake Up") a Voice</h2>
          <p className="mt-2">
            After downloading, you need to "wake up" or activate a Voice before you can use it. Go to Dashboard → Voices and click "Activate" on a downloaded Voice. This loads the model into memory and typically requires about <span className="font-semibold">10 GB of RAM</span>. Only one Voice can be active at a time.
          </p>

          <h2 className="text-2xl font-bold text-orange">Step 3: Convert Text</h2>
          <p className="mt-2">
            With a Voice active, go to Dashboard → Convert. Paste or type the text you want to rephrase, then click <span className="font-semibold">Convert</span>. The active Voice will rewrite your text in its style. You can convert as much text as you want while the Voice remains active.
          </p>

          <h2 className="text-2xl font-bold text-orange">Managing Voices</h2>
          <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
            <li>
              <span className="font-semibold">Switching Voices:</span> Deactivate the current Voice and activate a different one. You can only have one Voice active at a time.
            </li>
            <li>
              <span className="font-semibold">Storage:</span> Downloaded Voices take up disk space. You can delete Voices you no longer need from the Voices page.
            </li>
            <li>
              <span className="font-semibold">Memory:</span> Active Voices use significant RAM. Deactivate Voices when not in use to free up memory.
            </li>
          </ul>

          <h2 className="text-2xl font-bold text-orange">Creating Custom Voices</h2>
          <p className="mt-2">
            Custom Voice creation is not part of the local app. If you want a Voice trained on your own writing style, visit <a href="https://RewriteLikeMe.com" target="_blank" rel="noreferrer" className="text-orange underline">RewriteLikeMe.com</a> to create one. Once created, you may be able to download it for use in this local app (depending on your plan).
          </p>

          <h2 className="text-2xl font-bold text-orange">Troubleshooting</h2>
          <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
            <li>
              <span className="font-semibold">Activation failed or ran out of memory:</span> Close memory-intensive apps (web browsers, IDEs, etc.) and try again. Voice activation typically needs around 10 GB of free RAM.
            </li>
            <li>
              <span className="font-semibold">Slow performance:</span> Restart your computer to free up resources that may be held by other processes.
            </li>
            <li>
              <span className="font-semibold">Very old systems:</span> RewriteLikeMe should work on most hardware from this decade, but very lightweight systems may struggle to run the models locally.
            </li>
            <li>
              <span className="font-semibold">Other errors:</span> If you encounter unexpected errors, please reach out via Discord or GitHub with the error details.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HowTo;