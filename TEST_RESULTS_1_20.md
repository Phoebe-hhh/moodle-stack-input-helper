# STACK input helper: categories 1-20 regression

Date: 2026-07-15

Dataset: `/Users/phoebehuang/Documents/Study/HCI Mobile/test`

## Scope

- 118 images submitted to the configured Mathpix API.
- Raw LaTeX saved and reconverted with the updated local converter.
- All 118 records now produce a non-empty STACK result.
- The 20 input categories were checked against the expected expression encoded in each filename.

## Fixed regressions

- Pure formulas are no longer truncated to an inner exponent, fraction operand, bound, or matrix row.
- Nested fractions such as `\\frac{x^{2}+2x+1}{x+1}` retain the denominator.
- Fractions are tokenized recursively so symbols inside them can be selected.
- Sum and product bounds such as `k=1` are not treated as standalone equations.
- `\\text{e}` and `\\text{i}` are normalized to `%e` and `%i` for the dedicated constant samples.
- Matrix and piecewise `array` column separators are preserved.
- Two-solution equations such as `x=1,2` become `[1,2]`.

## Remaining OCR-level issues

These cannot be corrected globally without changing valid mathematical meaning:

1. `7-8/atan(x).png`: Mathpix reads the handwritten lowercase `x` as uppercase `X`, producing `atan(X)`.
2. `1-2/test1-2.jpeg`: this composite sheet's last nested fraction is read with the same expression in numerator and denominator. The corresponding individual image `1-2/1:(1+1:x).png` is recognized correctly as `1/(1+1/x)`.

`16-18/product(i,i,1,n).png` is read by Mathpix as `\\pi` rather than `\\prod`, but the converter safely recognizes the bounded-operator context and produces `product(i,i,1,n)`.

## Verification

- 118/118 saved OCR records reconverted without an empty STACK result.
- PHP syntax validation passed for every plugin PHP file.
- Focused regression tests were added for arithmetic, powers, roots, functions, constants, inequalities, calculus, sums/products, vectors, matrices, piecewise functions, and common answer forms.
