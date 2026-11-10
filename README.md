<p align="center">
  <img src="assets/banner.png" alt="Xtrematrix Prejudix — Variation · Inheritance · Natural Selection" width="100%">
</p>

<h1 align="center">🧬 Xtrematrix Prejudix</h1>

<p align="center"><em>Variation · Inheritance · Natural Selection</em></p>

<p align="center"><a href="https://xtrematrix.stark-kodex.workers.dev/"><strong>Explore the Matrix →</strong></a></p>

<p align="center">
  <a href="#-about">About</a> ·
  <a href="#-the-rabbits">Rabbits</a> ·
  <a href="#-three-events">Events</a> ·
  <a href="#-reading-the-data">Data</a> ·
  <a href="#-concepts-covered">Concepts</a> ·
  <a href="#-controls">Controls</a> ·
  <a href="#-teaching-model">Teaching model</a> ·
  <a href="#-technology">Technology</a> ·
  <a href="#-3d-models">3D Models</a> ·
  <a href="#-credits">Credits</a>
</p>

---

## 📖 About

An interactive simulator for teaching how **variation**, **inheritance** and **natural selection** work together. A meadow of rabbits differs in two heritable traits. You then apply selection pressures and watch the population change, generation by generation:

- **who survives** a food shortage, and who does not
- **who is taken** by predators, and why
- **how a new combination of traits appears** when two different parents mate

Built for classroom smart panels; it works on laptops and phones too.

---

## 📸 Screenshots

<table width="100%">
  <tr>
    <td width="33%" align="center">
      <img src="X3Matrix%20Assets/WlQ66.png" alt="White rabbit with long teeth" width="100%">
      <br><sub><b>White fur · Long teeth</b></sub>
    </td>
    <td width="33%" align="center">
      <img src="X3Matrix%20Assets/BlQ66.png" alt="Black rabbit with long teeth" width="100%">
      <br><sub><b>Black fur · Long teeth</b></sub>
    </td>
    <td width="33%" align="center">
      <img src="X3Matrix%20Assets/BSQ33.png" alt="Black rabbit with short teeth" width="100%">
      <br><sub><b>Black fur · Short teeth</b></sub>
    </td>
  </tr>
</table>

---

## 🐇 The Rabbits

Two traits, each controlled in the model by one gene with two alleles and complete dominance.

| Trait | Dominant allele | Recessive allele |
|:--|:--|:--|
| Fur colour | **B** → black | **b** → white |
| Tooth length | **L** → long | **l** → short |

**Generation 0** starts with 20 rabbits and only two phenotypes:

| Founders | Genotype | Phenotype |
|:--|:--|:--|
| White · long | `bb LL` | White fur, long teeth |
| Black · short | `BB ll` or `Bb ll` | Black fur, short teeth |

Nobody starts as **black with long teeth**. That third phenotype can only appear after reproduction, when the two founder types are crossed (`Bb Ll`).

---

## 🎬 Three Events

Each button applies one selection pressure. Only one event runs at a time.

### 🌱 Food decline

- About 90% of the grass patches fade away at random places and random moments, leaving roughly 10% as scarce food.
- **Short-toothed rabbits** weaken and slow down, then disappear one at a time as the food runs out.
- **Long-toothed rabbits** are not affected.

### 🦅 Eagle predation

- Four bald eagles glide in, strike with talons forward and carry their prey away. Each takes **one white rabbit**.
- A rabbit that is caught leaves the population and does not breed again.
- **Black rabbits are never targeted.**
- Afterwards a card explains that the more visible rabbits were removed.

### 🧬 Reproduction

- One adult **white · long** rabbit and one adult **black · short** rabbit are chosen as parents.
- A step-by-step card shows the parents, their hereditary information, the characteristics inherited, and the new offspring.
- The offspring is **black with long teeth**: a **new combination** of existing heritable characteristics, not a new trait.

---

## 📊 Reading the Data

| Panel | What it shows |
|:--|:--|
| **Legend** | Generation number, population size and a live count of each phenotype. Tap a row to highlight that phenotype. |
| **Trend graph** | Phenotype counts over time, or switch to **Alleles** to see the frequencies of **B** and **L** among the living rabbits' gene copies. G, E and R mark when each event began. |
| **Rabbit profile** | Hold a rabbit to open its card: its alleles at both loci, whether it is homozygous or heterozygous, its parents (or "Founder"), and a schematic of its two chromosome copies. The simulation pauses while the card is open. |

---

## 🌱 Concepts Covered

| Area | Concepts |
|:--|:--|
| Variation | Heritable differences between individuals · Phenotypes in a population |
| Inheritance | Genes and alleles · Dominant and recessive · Genotype → phenotype · Homozygous and heterozygous |
| Selection | Environmental pressures · Differential survival · Predation pressure · Food limitation |
| Change over time | Allele frequencies · Adaptation across generations · New combinations from reproduction |

---

## 🧭 Controls

| Control | What it does |
|:--|:--|
| **+ 5 rabbits** | Adds five new rabbits with random genotypes (up to 35 in total) |
| 🌿 Grass | Starts the food decline |
| 🦅 Eagle | Sends the eagles |
| ⚪⚪ Mating | Starts the reproduction event |
| ⏸ Pause | Freezes the rabbits, events and graphs |
| ↺ Reset | Returns to Generation 0 |
| ⬇ Save snapshot | Downloads this page as `index.html` with the current rabbit images built in |
| ⛶ Full screen | Fills the screen for classroom use |
| Hold a rabbit | Opens its profile card |
| Trend ▾ · Types / Alleles | Collapse the graph · switch what it plots |

---

## 🔬 Teaching Model

This is a deliberately **simplified** model of variation and inheritance. Real rabbit coat colour involves several genes, and incisor length is not a simple dominant trait. Here, fur colour and tooth length are treated as two independent single-gene traits so that the link from genotype to phenotype is easy to see.

The reproduction event is a **guided demonstration cross**: it shows how existing alleles from two different parents can combine into a phenotype that neither parent had.

---

## 💻 Technology

HTML · CSS · JavaScript · Three.js · Cloudflare Pages

The 3D rabbit and eagle models are baked to sprites and drawn on a 2D canvas scene. If the models fail to load, simplified drawn rabbits are shown instead.

---

## 🧩 3D Models

| | Asset | Model | Creator | Licence |
|:-:|:--|:--|:--|:--|
| 🦅 | Eagle, gliding approach | [Bald Eagle Flying Bird Model](https://sketchfab.com/3d-models/bald-eagle-flying-bird-model-30434fd1272f464a8540750a78a5087f) | Pigcraft | CC BY 4.0 |
| 🦅 | Eagle, strike and carry | [Bald Eagle Catching Fish](https://sketchfab.com/3d-models/bald-eagle-catching-fish-72d3775251a645a9aec7609cea6460e0) | ART & MODELING | CC BY 4.0 |
| 🐇 | Rabbit | [Rabbit Rigged](https://sketchfab.com/3d-models/rabbit-rigged-e7213589744d436b9d96e2dbb31198a5) | FourthGreen | CC BY 4.0 |

<sub>Original creators retain ownership of their models. Models were simplified and resized for this simulator; the fish was removed from the catching eagle so its talons can hold a rabbit, and the wingbeat is generated in code.</sub>

---

## 🤖 Credits

- OpenAI GPT 5.6: Prompt generation
- Claude Opus 5.5: Architecture planning
- Perplexity Sonar 2: Scientific reasoning
- GitHub & Codeberg: Repository
- Cloudflare Pages: Hosting

---

## 📜 License

Source code: **GNU GPL-3.0** (see [LICENSE](LICENSE)). 3D models keep their own licences (see [3D Models](#-3d-models)).

---

<p align="center">
  <b>Repository</b>: GitHub · Codeberg &nbsp;&nbsp;|&nbsp;&nbsp; <b>Hosting</b>: Cloudflare Pages
</p>
