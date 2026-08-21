import PageMeta from "../components/common/PageMeta";
import { Link } from "react-router";

/**
 * A tab that exists in the design but not in this build.
 *
 * It says so, rather than showing an empty state that could be mistaken for
 * "no data yet". The distinction matters in a demo: nobody should have to
 * guess whether a blank screen means the feature is missing or the query
 * returned nothing.
 */
export default function NotBuilt({ title, blurb }: { title: string; blurb: string }) {
  return (
    <>
      <PageMeta title={`${title} · Delivery`} description={blurb} />
      <div className="border-b border-black/[0.07] px-6 py-5">
        <h1 className="text-[19px] font-semibold text-gray-100">{title}</h1>
        <p className="mt-1 text-[12.5px] text-gray-500">{blurb}</p>
      </div>

      <div className="px-6 py-10">
        <div className="pane mx-auto max-w-md rounded-[10px] px-6 py-8 text-center">
          <div className="mx-auto grid size-9 place-items-center rounded-full bg-ink-800 text-gray-500">
            <svg viewBox="0 0 20 20" fill="none" className="size-4" aria-hidden="true">
              <path d="M10 3.5 16.5 6v4c0 3.5-2.6 5.9-6.5 7-3.9-1.1-6.5-3.5-6.5-7V6L10 3.5Z"
                    stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="mt-3 text-[13px] font-medium text-gray-200">Not built yet</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-gray-500">
            This tab is part of the target design and is deliberately empty in this
            build. Nothing behind it has been stubbed or simulated.
          </p>
          <Link
            to="/"
            className="mt-4 inline-block text-[12px] text-accent underline decoration-accent/30 hover:decoration-accent"
          >
            Back to My Tasks
          </Link>
        </div>
      </div>
    </>
  );
}
