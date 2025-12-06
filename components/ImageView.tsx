import React, { useState } from 'react';
import { Sparkles, Download, Loader2, Image as ImageIcon } from 'lucide-react';
import { generateImageFromPrompt } from '../services/gemini';

export const ImageView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const base64Image = await generateImageFromPrompt(prompt);
      setGeneratedImage(base64Image);
    } catch (err: any) {
      console.error(err);
      setError("Failed to generate image. Please try a different prompt.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100 overflow-y-auto">
      <div className="p-6 md:p-12 max-w-5xl mx-auto w-full flex-1 flex flex-col">
        
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-purple-500/10 rounded-2xl mb-4">
            <Sparkles className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 mb-4">
            Imagine Anything
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Powered by Gemini 2.5 Flash Image. Describe what you want to see, and watch it come to life instantly.
          </p>
        </div>

        {/* Input Section */}
        <div className="w-full max-w-3xl mx-auto mb-12">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="A futuristic city made of crystal, neon lights, 8k resolution..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-6 py-4 text-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
            />
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isLoading}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl px-8 py-4 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Dreaming...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Section */}
        <div className="flex-1 min-h-[400px] flex items-center justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 text-slate-500 animate-pulse">
              <div className="w-24 h-24 rounded-full border-4 border-slate-800 border-t-purple-500 animate-spin"></div>
              <p>Crafting your visual...</p>
            </div>
          ) : error ? (
            <div className="text-center p-8 bg-red-500/10 border border-red-500/20 rounded-2xl max-w-lg">
              <p className="text-red-400 font-medium mb-2">Generation Failed</p>
              <p className="text-slate-400 text-sm">{error}</p>
            </div>
          ) : generatedImage ? (
            <div className="relative group max-w-2xl w-full">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative bg-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src={generatedImage} 
                  alt={prompt} 
                  className="w-full h-auto object-contain max-h-[600px]"
                />
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a 
                    href={generatedImage} 
                    download={`gemini-${Date.now()}.png`}
                    className="p-3 bg-slate-900/80 backdrop-blur-sm text-white rounded-lg hover:bg-white hover:text-slate-900 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    <span className="text-sm font-medium">Download</span>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-slate-600">
              <div className="w-24 h-24 bg-slate-800 rounded-2xl flex items-center justify-center transform rotate-12">
                <ImageIcon className="w-10 h-10 text-slate-700" />
              </div>
              <p className="text-lg">Your imagination awaits.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};