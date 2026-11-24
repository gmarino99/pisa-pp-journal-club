# Higgs radial modes and the UV completion of non-linear sigma models — PRD revision (DT13405)

- `main.tex`, `refs.bib`, `figures/` → revised manuscript (REVTeX 4.2, PRD); `main.pdf` compiled.
- `response_to_referees.tex/.pdf` → point-by-point reply to Referees A and B.
- `checks/` → numerical verification of every claim (run `python3 verify.py`, `rigidity.py`, `expansion_check.py`; needs numpy, scipy).
  `verify_output.txt` is the reference output.

Build: `pdflatex main && bibtex main && pdflatex main && pdflatex main`.
