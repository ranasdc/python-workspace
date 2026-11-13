import { PublicShareView } from "@/components/ide/public-share-view"

const PY = [
  "# A long file, to check the screenshot covers code that is scrolled away",
  "import math",
  "",
  "class Shape:",
  '    """Base shape."""',
  "",
  "    def __init__(self, name):",
  "        self.name = name",
  "",
  "\tdef tabbed(self):",
  "\t\treturn 'tab\\tinside'",
  "",
  ...Array.from({ length: 70 }, (_, i) => `value_${i} = math.sqrt(${i}) + len("text ${i}")  # comment ${i}`),
  "",
  "for i in range(60):",
  '    print(f"Line {i}:", "x" * (i * 4))',
  'print("a\\tb\\tc")',
  'print("emoji 😀 done")',
  "raise ValueError('last line of the file')",
].join("\n")

const HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Tall page</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <header class="hero"><h1>Hero is 50vh tall</h1></header>
    <canvas id="c" width="200" height="80"></canvas>
    <p id="js">Not yet changed by script</p>
    <div id="rows"></div>
    <footer>THE VERY BOTTOM OF THE PAGE &amp; done</footer>
    <script src="script.js"></script>
  </body>
</html>
`

const CSS = `body { font-family: system-ui, sans-serif; margin: 0; background: #fdf6e3; }
.hero { height: 50vh; background: #268bd2; color: white; display: flex; align-items: center; justify-content: center; }
.row { padding: 24px; border-bottom: 1px solid #ccc; }
footer { background: #dc322f; color: white; padding: 24px; font-weight: bold; }
`

const JS = `document.getElementById("js").textContent = "Changed by script";
var rows = document.getElementById("rows");
for (var i = 1; i <= 40; i++) {
  var d = document.createElement("div");
  d.className = "row";
  d.textContent = "Row " + i;
  rows.appendChild(d);
}
var ctx = document.getElementById("c").getContext("2d");
ctx.fillStyle = "green";
ctx.fillRect(10, 10, 180, 60);
`

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>
}) {
  const { lang } = await searchParams
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col p-6">
      {lang === "html" ? (
        <PublicShareView
          fileName="index.html"
          language="html"
          bundle={[
            { name: "index.html", content: HTML },
            { name: "style.css", content: CSS },
            { name: "script.js", content: JS },
          ]}
        />
      ) : (
        <PublicShareView fileName="long.py" language="python" bundle={[{ name: "long.py", content: PY }]} />
      )}
    </main>
  )
}
