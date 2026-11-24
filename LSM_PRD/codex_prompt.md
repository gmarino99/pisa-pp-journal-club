# Codex prompt — make "Higgs radial modes in linear completions of non-linear sigma models" ready for PRD

Copy everything below the line into Codex, run from the root of the paper repository.

---

You are a senior theoretical particle physicist and scientific editor. Your task is to turn the manuscript in this repository into a version ready for submission to **Physical Review D**. The physics is already correct and verified: your job is **editorial restructuring, tightening, updating inputs and consistency checking**, not producing new results. Work in the repository, compile, verify, and report.

## 0. Context

- Author: Giulio Marino (single author), Univ. Pisa / INFN Pisa / Sapienza Roma.
- The paper is the revision of arXiv:2403.13926 (PRD manuscript DT13405). Two PRD referees (A and B) reviewed the first version; their reports are reproduced in Sec. 8 of this prompt. The revision must answer them.
- The current manuscript (`main.tex`, about 23 pages, REVTeX 4.2) contains:
  - Secs. I–VII: the formal part. Gauss equation, Propositions 1–4, Jordan-algebra construction, polar Lagrangian, exact amplitude, analytic N = 3 rigidity, N = 4 analysis, unitarity table and bounds.
  - Sec. VIII: custodial sum rules and electroweak embeddings.
  - Sec. IX: misaligned SU(5)/SO(5) and SU(6)/SO(6) benchmarks, the charged radial quintet and an ATLAS VBF reinterpretation.
  - Sec. X: one-loop scalar running.
  - Sec. XI: an elementary SM-doublet Higgs portal, di-Higgs production and a top-dependent boundedness test.
  - Appendices A–E.
- Numerical-check scripts live in the repository (look for `checks/` or the "supplied code" referred to in the text). Find and use them.

## 1. Calibrate on the author's style first (mandatory)

If you have network access, read the author's papers and extract their style:
- arXiv:2501.09073 (Barducci, Buttazzo, Dondarini, Franceschini, Marino, Mescia, Panci, *Scalar Rayleigh Dark Matter: current bounds and future prospects*, JHEP 06 (2025) 171);
- arXiv:2501.10504 (Aghaie, De la Torre Luque, Dondarini, Gaggero, Marino, Panci, *(H)ALPing the 511 keV line*);
- arXiv:2403.13926 v1 (the single-author first version of this work);
- INSPIRE author profile https://inspirehep.net/authors/2771622.

Write a short `STYLE_NOTES.md`: abstract length and structure, how the introduction is built, how results are stated, use of "we", typical section titles, figure-caption style, how conclusions end.

If you cannot access the network, use this style guide, derived from the author's papers:

- **Voice:** first-person plural "we", active and assertive. State results plainly: "We show that…", "We find…", "This implies…". Keep caveats few, precise, and placed once, often in footnotes; never repeat them.
- **Abstract:** 6–9 sentences, about 150–200 words. Structure: context and problem (1–2 sentences), what we do (1–2), main results stated concretely (3–4), consequences or prospects (1). No list of technical assumptions.
- **Introduction:** about 1.5 pages. Physics motivation, then the state of the art with references grouped by topic, then the open question in one sentence, then what this paper does and the main results (a short itemized list is fine), and finally "The paper is organized as follows. In Sec. II…".
- **Sections:** narrative, pedagogical but compact; each section opens with one sentence saying what it does. Derivations that interrupt the flow go to appendices.
- **Figures:** few and essential, with self-contained captions that say what is plotted, with which assumptions, and how to read it. Line styles plus colours, legible legends.
- **Conclusions:** a summary paragraph of the main results, one paragraph per main result, then an outlook paragraph with concrete future directions. No new caveats.
- **Language:** clear, simple English; sentences of at most about 30 words where possible; no defensive meta-commentary.

## 2. Hard constraints

1. **No new physics claims.** Do not change any equation, number, figure value or proposition statement unless (a) you find an error and (b) you verify the fix with the repository's code or an explicit derivation. Report every such change separately in `CHANGES.md` under "Corrections".
2. Every number quoted in the text must be reproducible by the repository's code. Re-run the scripts and compare.
3. Keep REVTeX 4.2 (`aps,prd,twocolumn`) and `apsrev4-2`. The final build must compile with no undefined references, no overfull boxes wider than 5pt, and no BibTeX errors.
4. Keep labels stable where possible, and update every `\ref`/`\eqref` you touch.
5. Do not delete correct results without a reason. You may move them to appendices or drop them if they are off-topic, but list each move or removal in `CHANGES.md`.
6. Target length: **15–17 pages** in PRD two-column format, including references.

## 3. Editorial tasks (in this order)

### 3.1 Title, abstract, introduction
- Keep the title, or propose at most two alternatives in `CHANGES.md` without applying them.
- **Rewrite the abstract** following the style in Sec. 1: about 180 words, no list of assumptions, results stated concretely. The key results are:
  - (i) the E² cancellation is the Gauss equation of the vacuum orbit;
  - (ii) a singlet radial mode is always necessary, with a curvature lower bound; singlets suffice iff the curvature is constant, i.e. N = 2;
  - (iii) unified Jordan-algebra construction and all-orders polar Lagrangian; all radial modes of the matrix model are necessary for N ≥ 3;
  - (iv) N = 3 rigidity in any completion; N = 4 admits other algebraic solutions;
  - (v) unitarity bounds m ≲ √(4π/N) f;
  - (vi) phenomenology: the charged radial quintet with an ATLAS VBF reinterpretation, and the perturbative window from running.
- **Rewrite the introduction** to about 1.5 pages with the structure of Sec. 1:
  - Remove the meta-paragraph "This manuscript revises the earlier version… Ref. [49]" and the self-citation of the earlier version. Mention the earlier version only in the cover letter and in the arXiv comments field.
  - Keep a single, short, positive statement of what is known (geometric EFT, Higgs sum rules, flavour decomposition) and what is new.
  - End with a "The paper is organized as follows" paragraph.

### 3.2 Consolidate assumptions; remove hedging
- Create one short subsection (in Sec. II, e.g. "II.C Scope and assumptions"), 5–8 lines, listing once:
  - finite-dimensional real scalar representation;
  - canonical kinetic terms in flat field space;
  - renormalizable G-invariant potential with a stable vacuum of the stated type;
  - tree level, gaugeless limit;
  - local statements (global quotients not classified).
- Then remove the repetitions of these caveats throughout the text.
- Delete or rewrite defensive meta-sentences. Typical patterns to remove: "This is not a claim…", "We do not label this…", "These are conditional tests…", "not a universal hypercolor prediction", "This does not require…", "We do not transfer…", "No blanket assertion…", "rather than a claim of priority…", "is supplementary", "This convention… not a sharp physical singularity". Keep a caveat only if it is physically essential, and then state it once, positively and briefly (a footnote is fine).
- Aim to reduce the total word count of Secs. I–VIII by about 25% without losing content.

### 3.3 Restructure the phenomenology (Secs. VIII–XI)
- **Sec. VIII + IX:** merge into one section, "Electroweak embeddings and charged radial modes". Keep:
  - the custodial tensor sum rule (Eq. 46) and its relation to Gunion–Haber–Wudka, condensed and with details in Appendix D;
  - the aligned embeddings with κ_V(h)² = r/n;
  - the misaligned SU(5)/SO(5) and SU(6)/SO(6) benchmark with the quintet couplings b_Q² = 2ξ, the widths, branching ratios 1/(n+2), the mass bounds, and the ATLAS VBF reinterpretation (Fig. 3).
- **Remove the ad hoc HL-LHC luminosity scaling** (Eq. 62, the dotted curves and the band in Fig. 3) unless a proper projection exists. Keep only the observed and expected ATLAS limits.
- **Simplify the Fig. 3 legends.** Each curve gets a physical label, for example "ATLAS observed", "ATLAS expected", "unitarity (m_h² > 0)", "Γ_Q/m_Q < 5%".
- **Sec. X (running):** keep it. It answers referee A's "triviality" remark. Make the definition of Λ_pert crisp, keep Fig. 4, and shorten the caveats.
- **Sec. XI (Higgs portal):** condense to at most about one page as an "illustrative application" subsection, or move it to an appendix. Before keeping any number:
  - **Update the SM inputs.** The current text uses m_t = 173.34 GeV and the fixed 2013 inputs of Buttazzo et al. Use PDG 2024: m_t = 172.57 ± 0.29 GeV, m_h = 125.20 ± 0.11 GeV, α_s(m_Z) = 0.1180 ± 0.0009. Use MS-bar matching consistent with Buttazzo et al. or more recent work.
  - SM vacuum-stability statements require at least two-loop running with NNLO matching. If the code supports it, use 2- or 3-loop SM RGEs with one-loop BSM contributions. If it does not, explicitly label Fig. 6 as a one-loop qualitative illustration and remove any quantitative statement on the instability scale.
  - Make sure the text explicitly discusses the dependence on m_t, which referee B asked for.
- Every phenomenology figure must have a caption that states the assumptions in one sentence.

### 3.4 Figures, tables, notation
- Check every figure has a number and a self-contained caption, and every table is properly framed with `ruledtabular`. Referee B complained about both in v1.
- Fig. 2 and Fig. 4: consistent fonts, colours plus line styles, axis labels with units. Regenerate them from the scripts if you change anything.
- Make notation uniform: H for the matrix field (calligraphic), f versus F = 2f (state the convention once), n versus N, D versus D_R, ξ = v²/F².
- Make sure that every symbol is defined at first use.

### 3.5 References
- Fetch BibTeX from INSPIRE for every entry, using INSPIRE texkeys. Fix authors, journals, pages and arXiv numbers.
- Check in particular: ATLAS PLB 860 (2025) 139137 [2407.10798] and its HEPData record; the ATLAS+CMS HL-LHC projections 2025 [2504.00672]; Bento–Haber–Romão–Silva JHEP 11 (2017) 095; Fichet et al. JHEP 09 (2016) 158; Cacciapaglia et al. JHEP 10 (2019) 035; Chang et al. PRD 100 (2019) 096001; Paterson NPB 190 (1981) 188.
- Remove the self-citation of the earlier version from the bibliography, unless it is cited for a specific result.
- Add the author's related papers only if they are genuinely relevant.

### 3.6 Code and data availability
- Add a short "Code availability" paragraph before the acknowledgments, pointing to a public repository (placeholder `https://github.com/<user>/<repo>`, to be filled in by the author), and list what the scripts check.
- Replace every in-text mention of "the supplied code" or "the supplied calculation" with a reference to that paragraph or to the specific appendix.

## 4. Verification

Re-run all the numerical-check scripts and confirm the following still hold after editing. Write the outcome to `VERIFICATION.md`.
- Lemma 1, Eqs. (12), (14), (57): f f = (2/n)D(D−1) − D C_d; C_d values; Σ(d^{ABQ})² = (n+2)/2.
- Table III eigenvalues and multiplicities for N = 2,…,6; Eqs. (43), (44), (59).
- Widths Γ^NGB = (n+2) m³/(64π f²) and BR = 1/(n+2).
- The beta functions in Eq. (63) against Paterson / Pisarski–Wilczek after normalization (chiral case: coefficients 4(N²+4), 16N, 12, 24, 8N in the canonical normalization).
- The custodial sum rule in Eq. (56) and κ_V(h)² = (8/n)ξ in the misaligned model, with an independent numerical check.
- After updating the SM inputs, recompute all of Sec. XI and Fig. 6 and update the numbers in the text.

## 5. Response to referees

Update `response_to_referees.tex`. If it does not exist, create it with one section per referee and one answer per point.
- Answer each point of referees A and B (Sec. 8) concisely and assertively, citing the new section, equation, figure and table numbers. Check every cross-reference against the compiled PDF.
- Add a short "Summary of changes" at the top, including the corrections of the v1 errors: the isotropic d-symbol ansatz, the wrong dimension of Sp(2N), and the parity statement.
- Referee B: give the m_t dependence, the Higgs-coupling sum rules with the LHC κ_V comparison, the radial mass scale and unitarity bounds, and the figure and table fixes.

## 6. Deliverables

1. Edited `main.tex`, `refs.bib` and figures; compiled `main.pdf`.
2. `diff.pdf`, made with `latexdiff` against the current version (`git show HEAD:main.tex > old.tex`).
3. `CHANGES.md`, with sections: "Structural changes", "Text tightening", "Corrections" (with verification), "Moved/removed material", "Open issues for the author".
4. `VERIFICATION.md` (Sec. 4) and `STYLE_NOTES.md` (Sec. 1).
5. Updated `response_to_referees.tex` and `.pdf`.
6. A draft cover letter, `cover_letter.tex`, to the PRD editor. It should mention DT13405, the time elapsed, and that the work is resubmitted as a substantially revised manuscript; it should list the main changes and offer the earlier referees if appropriate.

## 7. Final checklist (verify before finishing)

- [ ] 15–17 pages; compiles cleanly; no undefined references; no BibTeX errors.
- [ ] The abstract is 200 words or fewer, contains no list of assumptions, and states the main results concretely.
- [ ] The introduction ends with "The paper is organized as follows".
- [ ] Assumptions appear once, in a dedicated subsection; no defensive meta-sentences remain (grep for "not a claim", "we do not", "supplied code", "conditional", "not label").
- [ ] Top-quark and SM inputs are updated to PDG 2024, and the m_t dependence is discussed explicitly.
- [ ] The HL-LHC ad hoc extrapolation is removed.
- [ ] Every figure and table is numbered and captioned; legends are readable.
- [ ] Every number in the text is reproduced by the scripts (see `VERIFICATION.md`).
- [ ] The response letter answers every referee point with correct cross-references.
- [ ] Nothing in the physics changed unless it is documented and verified in "Corrections".

## 8. Referee reports (verbatim)

**Referee A**

> The manuscript describes how to construct a linear sigma model for the three standard technicolor implementations. This is in principle publishable but I find the amount of new material a bit on the low side for a typical Phys. Rev. D paper. The main new part is the claim (not really shown fully) which G representations one needs to get a UV completion with scalars added, which I believe can be derived much simpler.
> 1) The main proof is only given for the SU(N)xSU(N)/SU(N) case, the other cases are simply said 'it can be proven.' The conclusions and introduction claim the proof. So the part where it is actually shown that the full representation as given is needed must be included explicitly in 3.1 and 3.2 (as done in Sec. 2.2 for the standard case)
> 2) The equation numbering is strange, they use (a.b) but b does not reset when a is increased
> 3) The proof as asked for under point 1) should similarly point out the cases where a simpler version exists. Those cases are at least mentioned in the introduction.
> 4) Parity is not an accidental symmetry of the NLΣM, it is H to H† in the linear sigma model. A variant of the polar decomposition using H = uφu with u unitary and φ Hermitian makes this clear.
> 5) The main claim of the paper is derivable in a much simpler manner. The GB transform linearly under H, one needs to look at the possible representations of G that contain this as part of the full G representation. I am quite sure this requires in all the cases mentioned the full representation under G that is derived here. Then one writes the usual linear sigma model with that G representation which is automatically UV well-behaved (up to the triviality issue). This alternative way should be discussed in the manuscript and compared with the method of requiring good behavior in scattering amplitudes.

**Referee B**

> (a) 1. It has been pointed out that the Higgs vacuum stability/instability issue of the Standard Model can be addressed in the prescribed scenario. However, there is no discussion regarding the Higgs quartic coupling and the top quark mass. The nature of stability/instability strongly depends on top quark mass. There is no discussion in the context of this which is extremely crucial.
> 2. It must be pointed out, to study that the Higgs branching ratio and production should reproduce the SM benchmark values which have been studied by CMS and ATLAS at the LHC. [CMS and ATLAS Higgs public-results pages]
> 3. It is not clear in the article about the mass scale of mH² in Eq. 2.38 and how it is constrained by the observed Higgs mass and quartic coupling if the vacuum stability/instability scenario is satisfied.
> (b) 1. Figure numbers and captions must be given carefully and clearly. There are figures without any caption in this article.
> 2. There is a table in the article that must be properly framed.
