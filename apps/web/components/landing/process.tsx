import React from "react";
import { Jvideo } from "../common/video";
import { EmbedSnippetDemo } from "./embed-snippet-demo";

export default function Process() {
  return (
    <div id="how-it-works" className="w-full bg-green-50 px-6 py-16 md:px-40 md:py-32">
      <h3 className="text-3xl text-gray-500 max-w-6xl tracking-wide leading-snug md:text-4xl">
        <span className="text-gray-800">
          Go from setup to answering customers in minutes,
        </span>{" "}
        with no prompt engineering or extra tools. Just three simple steps that
        work for any business, from local shops to nationwide operations.
      </h3>

      {/* STEPS */}

      <div className="mt-16 grid grid-cols-1 gap-4 w-full md:mt-40 md:grid-cols-6 md:gap-0">
        <p className="text-sm text-gray-500 grid col-span-1 md:col-span-1">STEPS</p>

        <div className="grid grid-cols-1 gap-12 w-full md:col-span-5 md:grid-cols-5 md:gap-24">
          <div className="grid grid-cols-1 gap-8 w-full h-full md:col-span-5 md:grid-cols-5 md:gap-12">
            <div className="w-full h-full flex items-center md:col-span-2">
              <div className="flex flex-col justify-center">
                <h5 className="text-sm mb-6 text-gray-500 text-start">01</h5>
                <h3 className="text-3xl text-gray-700 md:text-4xl">
                  Give your business its own workspace
                </h3>

                <p className="mt-6 text-lg text-gray-500 md:text-2xl">
                  Create a dedicated space for your business, complete with its
                  own AI agent, knowledge base, domain, and embed key.
                  Everything stays organized and connected to the right
                  business.
                </p>
              </div>
            </div>
            <div className="w-full h-fit md:col-span-3 md:mt-10">
              <Jvideo
                src="/vids/ps1.webm"
                poster="/vids/ps1.webp"
                className="rounded-xl w-full h-full object-cover block"
              />
            </div>
          </div>

          {/* Step 2 — title overlaid on the video's bottom-left corner */}
          <div className="w-full md:col-span-5">
            <h5 className="text-sm mb-6 text-gray-500 ">
                  02
                </h5>
            <div className="relative w-full md:mt-10">
              <Jvideo
                src="/vids/ps2.webm"
                poster="/vids/ps2.webp"
                containerClassName="min-h-[440px] sm:min-h-0"
                className="rounded-xl w-full h-full object-cover block aspect-video"
              />

              {/* Soft darkening so the overlay text stays readable */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-96 rounded-b-xl bg-gradient-to-t from-black/80 via-black/40 to-transparent"
              />

              {/* process title */}
              <div className="absolute bottom-4 left-4 right-4 max-w-md md:bottom-6 md:left-6 md:right-6">
                <h3 className="text-2xl text-white md:text-4xl">
                  Make it an expert on your business
                </h3>

                <p className="mt-6 text-base text-gray-300 md:text-2xl">
                  Upload documents, crawl your website, or connect your
                  PostgreSQL, MySQL, MongoDB, or Convex database to give your AI
                  agent the knowledge it needs to deliver accurate,
                  business-specific answers.
                </p>
              </div>
            </div>
          </div>
          {/* Step 3 */}
          <div className="w-full h-full flex items-center md:col-span-2">
            <div className="">
              <h5 className="text-sm mb-6 text-gray-500">03</h5>
              <h3 className="text-3xl text-gray-700 md:text-4xl">
                Bring your AI agent to your website
              </h3>

              <p className="mt-6 text-lg text-gray-500 md:text-2xl">
                Add one simple snippet before your closing body tag and your
                branded chat widget is ready to go, seamlessly fitting into your
                website and answering customers using your business knowledge.
              </p>
            </div>
          </div>
          {/* Snippet div */}
          <div className="w-full h-fit md:col-span-3 md:mt-10">
            <EmbedSnippetDemo />
          </div>
        </div>
      </div>
    </div>
  );
}
