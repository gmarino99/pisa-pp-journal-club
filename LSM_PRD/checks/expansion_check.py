"""Check the explicit expansion (Appendix B) of the closed-form kinetic Lagrangian:
 L = 1/2 (dpi)^2 + 1/2 (drho)^2 - 1/(6f^2) f^{ABI} f^{CDI} pi^A dpi^B pi^C dpi^D
     + (1/f) d^{ABC} rho^C dpi^A dpi^B + 1/(2f^2) d^{ACE} d^{BDE} rho^C rho^D dpi^A dpi^B
     - 1/(2f^2) f^{ABI} f^{CEI} pi^A dpi^B rho^C drho^E + O(5 fields)
 evaluated with one space-time derivative direction (dX = dX/dx). Residual must scale as eps^5."""
import numpy as np
from scipy.linalg import expm
from verify import coset, structure
rng=np.random.default_rng(3)
for case,N in (('I',3),('II',3),('III',2)):
    n,p,h,Om=coset(case,N); d,f=structure(p,h); P=np.array(p); D=len(p); f0=1.0
    pi0,pi1,r0,r1=[rng.normal(size=D) for _ in range(4)]
    res=[]
    for eps in (0.1,0.05,0.025):
        def H(x):
            A=np.einsum('a,aij->ij',eps*(pi0+x*pi1),P)/f0; u=expm(1j*A)
            Phi=f0*np.eye(n)+2*np.einsum('a,aij->ij',eps*(r0+x*r1),P)
            return u@Phi@u/np.sqrt(2) if case=='I' else u@Phi@Om@u.T/np.sqrt(2)
        h_=1e-5; dH=(H(h_)-H(-h_))/(2*h_)
        Lfull=0.5*np.trace(dH.conj().T@dH).real
        pi,dpi,r,dr=eps*pi0,eps*pi1,eps*r0,eps*r1
        L=0.5*dpi@dpi+0.5*dr@dr
        L+=-np.einsum('abi,cdi,a,b,c,d',f,f,pi,dpi,pi,dpi)/(6*f0**2)
        L+=np.einsum('abc,c,a,b',d,r,dpi,dpi)/f0
        L+=np.einsum('ace,bde,c,d,a,b',d,d,r,r,dpi,dpi)/(2*f0**2)
        L+=-np.einsum('abi,cei,a,b,c,e',f,f,pi,dpi,r,dr)/(2*f0**2)
        res.append(abs(Lfull-L))
    print(case,N,'residuals',res,' ratios',res[0]/res[1],res[1]/res[2],'(expect ~32 for eps^5)')
