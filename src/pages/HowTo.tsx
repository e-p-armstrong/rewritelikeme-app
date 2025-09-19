import React from 'react';

const HowTo: React.FC = () => {
  return (
    <div className="min-h-screen bg-floral-white text-black">
      <div className="container mx-auto p-4">
        <h1 className="text-4xl font-bold text-orange mt-20 text-center">How to Use RewriteLikeMe</h1>
        <div className="mt-8 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-orange">Step 1: Create a Voice</h2>
          <p className="mt-2">
            First, navigate to your dashboard. Click on the "Create Voice" button.
          </p>
          <h2 className="text-2xl font-bold text-orange mt-4">Step 2: Add Documents</h2>
          <p className="mt-2">
            After creating your Voice, you need to provide it with examples of the writing style you want it to learn. Add documents (like articles, emails, or book excerpts) that are representative of that style. The more high-quality examples you provide, the better the Voice will be at mimicking the style.
          </p>
          <h2 className="text-2xl font-bold text-orange mt-4">Step 3: Train and Wake Up</h2>
          <p className="mt-2">
            Once you've added your documents, you can start the training process. This will take a fixed number of credits. When the training is complete, you can "wake up" your Voice. Waking up a Voice costs credits per hour.
          </p>
          <h2 className="text-2xl font-bold text-orange mt-4">Step 4: Convert Text</h2>
          <p className="mt-2">
            With your Voice awake, you can now use it to convert text into the learned writing style. As long as the Voice is awake, you can rewrite any text you want.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HowTo;