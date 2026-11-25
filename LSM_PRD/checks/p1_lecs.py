"""Point 1: tree-level O(p^4) Lagrangian from integrating out the radial modes.
Claim:  L4 = a [Tr(d.d)]^2 + b Tr(d_mu d^mu d_nu d^nu),
        a = 4 f^2/(n m_h^2) - 4 f^2/(n m_H^2),   b = 4 f^2/m_H^2.
Check: the 4-NGB amplitude of L4 (with d_mu = dpi.X/f) equals the O(s^2) term of the exact amplitude
        A4 = (1/f^2) sum_E (1/m_E^2)[d^{ABE}d^{CDE} s^2 + d^{ACE}d^{BDE} t^2 + d^{ADE}d^{BCE} u^2]."""
import numpy as np, itertools
from verify import coset, structure
rng=np.random.default_rng(7)
def check(case,N,mh=1.3,mH=0.7,f=1.0):
    n,p,h,_=coset(case,N); d,_=structure(p,h); P=np.array(p); D=len(p)
    m2=np.array([mh**2]+[mH**2]*(D-1))
    a=4*f**2/(n*mh**2)-4*f**2/(n*mH**2); b=4*f**2/mH**2
    # tensors: [Tr d.d]^2 -> (1/f^4) Tr(XAXB)Tr(XCXD) dA.dB dC.dD ; Tr(dddd) -> (1/f^4) Tr(XA XB XC XD) (dA.dB)(dC.dD)
    T2=np.einsum('aij,bji->ab',P,P).real
    T4=np.einsum('aij,bjk,ckl,dli->abcd',P,P,P,P)
    err=0
    for _ in range(40):
        fl=rng.integers(0,D,size=4); s=1.7; t=-0.6; u=-s-t
        pp={(0,1):s/2,(2,3):s/2,(0,2):t/2,(1,3):t/2,(0,3):u/2,(1,2):u/2}
        dot=lambda i,j: pp[tuple(sorted((i,j)))]
        M=0
        for sg in itertools.permutations(range(4)):
            A,B,C,Dd=[fl[k] for k in sg]
            # each term: coeff * (p_sg0.p_sg1)(p_sg2.p_sg3) ; (-i)^4 = 1 ; i M = i * coeff
            M+=(a*T2[A,B]*T2[C,Dd]+b*T4[A,B,C,Dd].real)*dot(sg[0],sg[1])*dot(sg[2],sg[3])/f**4
        A_,B_,C_,D_=fl
        Mex=sum((d[A_,B_,E]*d[C_,D_,E]*s**2+d[A_,C_,E]*d[B_,D_,E]*t**2+d[A_,D_,E]*d[B_,C_,E]*u**2)/m2[E] for E in range(D))/f**2
        err=max(err,abs(M-Mex))
    return err
for case,N in (('I',2),('I',3),('II',3),('III',2),('III',3)):
    print(case,N,'max |A(L4) - A4(exact)| =',check(case,N))
