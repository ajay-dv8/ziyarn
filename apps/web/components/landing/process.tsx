import React from "react";
import { Jvideo } from "../common/video";
import { EmbedSnippetDemo } from "./embed-snippet-demo";

export default function Process() {
  return (
    <div className="w-full px-40 py-32 bg-green-50">
      <h3 className="text-4xl text-gray-500 max-w-6xl tracking-wide leading-snug">
        <span className="text-gray-800">
          Go from setup to answering customers in minutes,
        </span>{" "}
        with no prompt engineering or extra tools. Just three simple steps that
        work for any business, from local shops to nationwide operations.
      </h3>

      {/* STEPS */}

      <div className="mt-40 grid grid-cols-6 w-full">
        <p className="text-sm text-gray-500 grid col-span-1">STEPS</p>

        <div className="grid col-span-5 grid-cols-5 gap-24 w-full">
          <div className="grid col-span-5 grid-cols-5 gap-12 w-full h-full">
            <div className="col-span-2 w-full h-full flex items-center">
              <div className="flex flex-col justify-center">
                <h5 className="text-sm mb-6 text-gray-500 text-start">01</h5>
                <h3 className="text-4xl text-gray-700">
                  Give your business its own workspace
                </h3>

                <p className="mt-6 text-2xl text-gray-500">
                  Create a dedicated space for your business, complete with its
                  own AI agent, knowledge base, domain, and embed key.
                  Everything stays organized and connected to the right
                  business.
                </p>
              </div>
            </div>
            <div className="col-span-3 w-full mt-10 h-fit">
              <Jvideo
                src="/vids/ps1.webm"
                poster="/vids/ps1.webp"
                className="rounded-xl w-full h-full object-cover block"
              />
            </div>
          </div>

          {/* Step 2 — title overlaid on the video's bottom-left corner */}
          <div className="col-span-5 w-full">
            <h5 className="text-sm mb-6 text-gray-500 ">
                  02
                </h5>
            <div className="relative w-full mt-10">
              <Jvideo
                src="/vids/ps2.webm"
                poster="/vids/ps2.webp"
                className="rounded-xl w-full h-full object-cover block aspect-video"
              />

              {/* Soft darkening so the overlay text stays readable */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-96 rounded-b-xl bg-gradient-to-t from-black/80 via-black/40 to-transparent"
              />

              {/* process title */}
              <div className="absolute bottom-6 left-6 max-w-md">
                <h3 className="text-4xl text-white">
                  Make it an expert on your business
                </h3>

                <p className="mt-6 text-2xl text-gray-300">
                  Upload documents, crawl your website, or connect your
                  PostgreSQL, MySQL, MongoDB, or Convex database to give your AI
                  agent the knowledge it needs to deliver accurate,
                  business-specific answers.
                </p>
              </div>
            </div>
          </div>
          {/* Step 3 */}
          <div className="col-span-2 w-full h-full flex items-center">
            <div className="">
              <h5 className="text-sm mb-6 text-gray-500">03</h5>
              <h3 className="text-4xl text-gray-700">
                Bring your AI agent to your website
              </h3>

              <p className="mt-6 text-2xl text-gray-500">
                Add one simple snippet before your closing body tag and your
                branded chat widget is ready to go, seamlessly fitting into your
                website and answering customers using your business knowledge.
              </p>
            </div>
          </div>
          {/* Snippet div */}
          <div className="col-span-3 w-full h-fit mt-10">
            <EmbedSnippetDemo />
          </div>
        </div>
      </div>
    </div>
  );
}
