import React from 'react'
import { Jvideo } from '../common/video'

export default function Process() {
  return (
    <div className='w-full px-40 py-24'>
      <h3 className='text-4xl text-gray-400 max-w-6xl tracking-wide leading-snug'>
        <span className="text-gray-100">Go from setup to answering customers in minutes,</span> with no prompt engineering or extra tools. Just three simple steps that work for any business, from local shops to nationwide operations.
      </h3>

      {/* STEPS */}

      <div className="mt-24 grid grid-cols-6 gap-12 w-full">
        <p className="text-sm text-gray-400 grid col-span-1">STEPS</p>

        <div className="grid col-span-5 grid-cols-5 gap-12 w-full">
          <div className="col-span-2 w-full">
            <div className="">
              <h5 className="text-sm mb-6 text-gray-400">01</h5>
              <h3 className="text-4xl">Give your business its own workspace</h3>

              <p className="mt-6 text-2xl text-gray-400">
                Create a dedicated space for your business, complete with its own AI agent, knowledge base, domain, and embed key. Everything stays organized and connected to the right business.
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

          {/* Step 2 */}
          <div className="col-span-2 w-full">
            <div className="">
              <h5 className="text-sm mb-6 text-gray-400">02</h5>
              <h3 className="text-4xl">Make it an expert on your business</h3>

              <p className="mt-6 text-2xl text-gray-400">
                Upload documents, crawl your website, or connect your PostgreSQL, MySQL, MongoDB, or Convex database to give your AI agent the knowledge it needs to deliver accurate, business-specific answers.
              </p>
            </div>
          </div>
          <div className="col-span-3 w-full bg-amber-800">
            
          </div>

          {/* Step 3 */}
          <div className="col-span-2 w-full">
            <div className="">
              <h5 className="text-sm mb-6 text-gray-400">03</h5>
              <h3 className="text-4xl">Bring your AI agent to your website</h3>

              <p className="mt-6 text-2xl text-gray-400">
                Add one simple snippet before your closing body tag and your branded chat widget is ready to go, seamlessly fitting into your website and answering customers using your business knowledge.
              </p>
            </div>
          </div>
          <div className="col-span-3 w-full bg-amber-800">
            
          </div>
        </div>   
      </div>
  </div>  
  )
}
