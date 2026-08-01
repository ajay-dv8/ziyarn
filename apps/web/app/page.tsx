import Image, { type ImageProps } from "next/image";
import { Button } from "@repo/ui/button";
import { Code } from "@repo/ui/code";

type Props = Omit<ImageProps, "src"> & {
  srcLight: string;
  srcDark: string;
};

const ThemeImage = (props: Props) => {
  const { srcLight, srcDark, ...rest } = props;

  return (
    <>
      <Image {...rest} src={srcLight} className="imgLight" />
      <Image {...rest} src={srcDark} className="imgDark" />
    </>
  );
};

export default function Home() {
  return (
    <div className="grid min-h-svh grid-rows-[20px_1fr_20px] items-center justify-items-center gap-16 p-8 pb-20 [font-synthesis:none] sm:p-20">
      <main className="row-start-2 flex flex-col items-center gap-8 sm:items-start">
        <ThemeImage
          className="dark:invert"
          srcLight="turborepo-dark.svg"
          srcDark="turborepo-light.svg"
          alt="Turborepo logo"
          width={180}
          height={38}
          priority
        />
        <ol className="m-0 list-inside p-0 text-center font-mono text-sm leading-6 tracking-tight [&>li:not(:last-child)]:mb-2 sm:text-left">
          <li>
            Get started by editing <Code>apps/web/app/page.tsx</Code>
          </li>
          <li>Save and see your changes instantly.</li>
        </ol>

        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <a
            className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-transparent bg-foreground px-5 font-sans text-base font-medium leading-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            href="https://vercel.com/new/clone?demo-description=Learn+to+implement+a+monorepo+with+a+two+Next.js+sites+that+has+installed+three+local+packages.&demo-image=%2F%2Fimages.ctfassets.net%2Fe5382hct74si%2F4K8ZISWAzJ8X1504ca0zmC%2F0b21a1c6246add355e55816278ef54bc%2FBasic.png&demo-title=Monorepo+with+Turborepo&demo-url=https%3A%2F%2Fexamples-basic-web.vercel.sh%2F&from=templates&project-name=Monorepo+with+Turborepo&repository-name=monorepo-turborepo&repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fturborepo%2Ftree%2Fmain%2Fexamples%2Fbasic&root-directory=apps%2Fdocs&skippable-integrations=1&teamSlug=vercel&utm_source=create-turbo"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
          <a
            className="flex h-12 min-w-[180px] cursor-pointer items-center justify-center rounded-full border border-black/10 px-5 font-sans text-base font-medium leading-5 transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            href="https://turborepo.dev/docs?utm_source"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read our docs
          </a>
        </div>
        <Button
          appName="web"
          className="border-black/10 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          Open alert
        </Button>
      </main>
      <footer className="row-start-3 flex flex-wrap items-center justify-center gap-6 font-sans">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?search=turborepo&utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://turborepo.dev?utm_source=create-turbo"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to turborepo.dev →
        </a>
      </footer>
    </div>
  );
}
