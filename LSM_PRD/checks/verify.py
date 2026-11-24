"""
Numerical verification of the results of
"Radial modes and the linear UV completion of non-linear sigma models"
for the three cosets
   I  : U(N)_L x U(N)_R / U(N)_V      (H in Mat(N,C),  H -> L H R^dag)
   II : U(N) / O(N)                  (H = H^T,        H -> V H V^T)
   III: U(2N)/ Sp(2N)                (H = -H^T,       H -> V H V^T)
(U(1) factor included; the U(1) NGB is eta = pi^0.)
Checks:
 (0) the isotropic ansatz d d = A dd + B(dd+dd) used in the original draft is false for N>=3
 (1) closure {X_A,X_B} = d_ABC X_C  and [X_a,X_b] = i f_abi T_i
 (2) Gauss identity  f_ABI f_CDI = d_ACE d_BDE - d_ADE d_BCE
 (3) all-orders kinetic term  1/2 Tr dH^dag dH = 1/4 Tr (nabla Phi)^2 + 1/4 Tr {d,Phi}^2
     with H = u Phi u^T (II,III; times Omega in III) or u Phi u (I)  -> no odd-pi terms
 (4) tree-level pi pi -> pi pi amplitude: O(s) growth cancels iff all radial modes kept
 (5) sectional curvature: constant (sphere) only for N=2
 (6) tree-level unitarity eigenvalues of the quartic potential
"""
import numpy as np, itertools, sys
from scipy.linalg import expm
rng = np.random.default_rng(1)
np.set_printoptions(precision=5, suppress=True, linewidth=150)

def herm_basis(n):
    B=[]
    for i in range(n):
        for j in range(i,n):
            if i==j:
                M=np.zeros((n,n),complex); M[i,i]=1; B.append(M)
            else:
                M=np.zeros((n,n),complex); M[i,j]=M[j,i]=1; B.append(M)
                M=np.zeros((n,n),complex); M[i,j]=-1j; M[j,i]=1j; B.append(M)
    return B

def gram(B, norm=0.5):
    out=[]
    for M in B:
        V=M.copy()
        for O in out: V-= (np.trace(O@V).real/np.trace(O@O).real)*O
        nv=np.trace(V@V).real
        if nv>1e-10: out.append(V/np.sqrt(nv/norm))
    return out

def Omega(N):
    Z=np.zeros((N,N)); I=np.eye(N)
    return np.block([[Z,I],[-I,Z]]).astype(complex)

def coset(case,N):
    """return n, list of p generators (X^0 first, proportional to 1), list of h generators, Omega"""
    if case=='I':
        n=N; Om=np.eye(n); allH=herm_basis(n)
        p=[np.eye(n)/np.sqrt(2*n)]+[M for M in allH]
        p=gram(p); h=gram([M for M in p[1:]])   # h = su(N) (same matrices, acting diagonally)
        return n,p,h,Om
    if case=='II':
        n=N; Om=np.eye(n); allH=herm_basis(n)
        P=lambda M:(M+M.conj())/2; Hh=lambda M:(M-M.conj())/2
        p=gram([np.eye(n)/np.sqrt(2*n)]+[P(M) for M in allH])
        h=gram([Hh(M) for M in allH])
        return n,p,h,Om
    if case=='III':
        n=2*N; Om=Omega(N); allH=herm_basis(n); Oi=np.linalg.inv(Om)
        # p: X^T Om = Om X  <=> X = Oi X^T Om ; h: T^T Om = -Om T
        P=lambda M:(M+Oi@M.T@Om)/2; Hh=lambda M:(M-Oi@M.T@Om)/2
        p=gram([np.eye(n)/np.sqrt(2*n)]+[P(M) for M in allH])
        h=gram([Hh(M) for M in allH])
        return n,p,h,Om

def structure(p,h):
    D=len(p); K=len(h)
    d=np.zeros((D,D,D)); f=np.zeros((D,D,K))
    for A in range(D):
        for B in range(D):
            ac=p[A]@p[B]+p[B]@p[A]; cm=p[A]@p[B]-p[B]@p[A]
            for C in range(D): d[A,B,C]=2*np.trace(ac@p[C]).real
            for I in range(K): f[A,B,I]=(-2j*np.trace(cm@h[I])).real
            # closure checks
            assert np.allclose(ac, np.einsum('c,cij->ij',d[A,B],np.array(p))), 'closure {p,p}'
            assert np.allclose(cm, 1j*np.einsum('c,cij->ij',f[A,B],np.array(h))), 'closure [p,p]'
    return d,f

def check_gauss(d,f):
    lhs=np.einsum('abi,cdi->abcd',f,f)
    rhs=np.einsum('ace,bde->abcd',d,d)-np.einsum('ade,bce->abcd',d,d)
    return np.abs(lhs-rhs).max()

# ---------------- (0) isotropic ansatz of the original draft ----------------
def check_ansatz(N):
    n,p,h,_=coset('I',N); d,f=structure(p,h)
    ds=d[1:,1:,1:]; D=N*N-1; dl=np.eye(D)
    dd=np.einsum('abe,cde->abcd',ds,ds)
    A=-2*(N**2-4)/(N*(N**2-2)*(N**2+1)); B=(N**2-4)*(N**2-1)/(N*(N**2-2)*(N**2+1))
    ans=A*np.einsum('ab,cd->abcd',dl,dl)+B*(np.einsum('ac,bd->abcd',dl,dl)+np.einsum('ad,bc->abcd',dl,dl))
    fs=f[1:,1:,:]; ff=np.einsum('abi,cdi->abcd',fs,fs)
    Ct=N/(N**2-2); ffans=Ct*(np.einsum('ac,bd->abcd',dl,dl)-np.einsum('ad,bc->abcd',dl,dl))
    return np.abs(dd-ans).max(), np.abs(ff-ffans).max()

# ---------------- (3) all-orders kinetic term ----------------
def check_kinetic(case,N,f0=1.3,eps=1e-5):
    n,p,h,Om=coset(case,N); P=np.array(p); Hh=np.array(h); D=len(p)
    pi0=rng.normal(size=D)*0.7; pi1=rng.normal(size=D)
    r0=rng.normal(size=D)*0.4; r1=rng.normal(size=D)
    def fields(x):
        A=np.einsum('a,aij->ij',pi0+x*pi1,P)/f0
        u=expm(1j*A)
        Phi=f0*np.eye(n)+2*np.einsum('a,aij->ij',r0+x*r1,P)
        if case=='I': H=u@Phi@u/np.sqrt(2)
        else: H=u@Phi@Om@u.T/np.sqrt(2)
        return H,u,Phi
    Hp,_,_=fields(eps); Hm,_,_=fields(-eps); dH=(Hp-Hm)/(2*eps)
    lhs=0.5*np.trace(dH.conj().T@dH).real
    H0,u,Phi=fields(0)
    up,_,_=fields(eps); 
    _,up,Phip=fields(eps); _,um,Phim=fields(-eps)
    du=(up-um)/(2*eps); dPhi=(Phip-Phim)/(2*eps)
    if case=='I':
        # u_L=u, u_R=u^dag ; d=(u^dag du - u du^dag)/(2i), E=(u^dag du + u du^dag)/(2i)
        a=u.conj().T@du; b=u@(du.conj().T)
        d=(a-b)/(2j); E=(a+b)/(2j)
    else:
        a=u.conj().T@du        # = i(d+E)
        mc=a/1j
        # project onto p and h
        d=sum(2*np.trace(X@mc).real*X for X in p)+0j
        E=sum(2*np.trace(T@mc).real*T for T in h)+0j
        assert np.allclose(d+E,mc)
    nab=dPhi+1j*(E@Phi-Phi@E)
    acd=d@Phi+Phi@d
    rhs=0.25*np.trace(nab@nab).real+0.25*np.trace(acd@acd).real
    return abs(lhs-rhs)/abs(lhs)

# ---------------- (4) pi pi scattering ----------------
def amp(d,f,fdec,a,b,c,e,s,t,mh,mH,keep=('h','H')):
    """a b -> c e  (all pi^a with a>=1, i.e. eta excluded), massless kinematics. s,t ; u=-s-t"""
    u=-s-t
    F=np.einsum('abi,cdi->abcd',f,f)
    # contact from -1/(6 f^2) F_{abcd} pi^a dpi^b pi^c dpi^d ; incoming momenta p1..p4, p_i.p_j
    pp={(1,2):s/2,(3,4):s/2,(1,3):t/2,(2,4):t/2,(1,4):u/2,(2,3):u/2}
    dot=lambda i,j: 0 if i==j else pp[tuple(sorted((i,j)))]
    fl={1:a,2:b,3:c,4:e}
    Mc=0
    for sg in itertools.permutations([1,2,3,4]):
        Mc+=F[fl[sg[0]],fl[sg[1]],fl[sg[2]],fl[sg[3]]]*dot(sg[1],sg[3])
    Mc/=6*fdec**2
    Me=0
    for r in range(d.shape[2]):
        m2=mh**2 if r==0 else mH**2
        if (r==0 and 'h' not in keep) or (r>0 and 'H' not in keep): continue
        g=d[:,:,r]
        Me+=-(g[a,b]*g[c,e]*s**2/(s-m2)+g[a,c]*g[b,e]*t**2/(t-m2)+g[a,e]*g[b,c]*u**2/(u-m2))/fdec**2
    return Mc+Me

def growth(case,N,keep):
    """max norm of the residual Gauss tensor  f f - (G_ac,bd - G_ad,bc) restricted to pi^a, a>=1"""
    n,p,h,_=coset(case,N); d,f=structure(p,h)
    ds=d[1:,1:,:].copy(); fs=f[1:,1:,:]
    if 'h' not in keep: ds[:,:,0]=0
    if 'H' not in keep: ds[:,:,1:]=0
    ff=np.einsum('abi,cdi->abcd',fs,fs)
    G=np.einsum('ace,bde->abcd',ds,ds)-np.einsum('ade,bce->abcd',ds,ds)
    return np.abs(ff-G).max()

def growth_sampled(case,N,keep):
    n,p,h,_=coset(case,N); d,f=structure(p,h); D=len(p)
    worst=0
    for trial in range(30):
        a,b,c,e=rng.integers(1,D,size=4)
        vals=[]
        for s in (1e4,1e6):
            t=-0.37*s
            vals.append(amp(d,f,1.0,a,b,c,e,s,t,1.0,1.7,keep))
        # coefficient of s ~ difference / delta s
        worst=max(worst,abs(vals[1]-vals[0])/(1e6-1e4))
    return worst

# ---------------- (5) sectional curvature ----------------
def sectional(case,N):
    n,p,h,_=coset(case,N); d,f=structure(p,h)
    fs=f[1:,1:,:]; R=np.einsum('abi,cdi->abcd',fs,fs)
    D=fs.shape[0]; K=[]
    for a in range(D):
        for b in range(a+1,D): K.append(R[a,b,a,b])
    return min(K),max(K)

# ---------------- (6) unitarity of the quartic potential ----------------
def unitarity(case,N):
    n,p,h,Om=coset(case,N)
    Bs=[X*np.sqrt(2) for X in p]            # Tr(B_k B_l)=delta
    if case=='III': Bs=[B@Om for B in Bs]
    E=Bs+[1j*B for B in Bs]                 # H = sum phi_i E_i, canonical with L=1/2 Tr dH^dag dH
    M=len(E); Earr=np.array(E)
    q=np.einsum('iab,jab->ij',Earr.conj(),Earr).real   # Tr(E_i^dag E_j)
    q=(q+q.T)/2
    T=np.einsum('iba,jbc,kdc,lda->ijkl',Earr.conj(),Earr,Earr.conj(),Earr).real  # Tr(E_i^dag E_j E_k^dag E_l)
    def sym(X):
        return sum(np.transpose(X,pm) for pm in itertools.permutations(range(4)))/24
    L1=24/4*sym(np.einsum('ij,kl->ijkl',q,q)); L2=24/4*sym(T)
    idx=[(i,j) for i in range(M) for j in range(i,M)]
    c=np.array([1/np.sqrt(2) if i==j else 1. for i,j in idx])
    I1=np.array([i for i,j in idx]); J1=np.array([j for i,j in idx])
    K1=L1[I1][:,J1][:, :, I1, J1] if False else L1[I1[:,None],J1[:,None],I1[None,:],J1[None,:]]*np.outer(c,c)
    K2=L2[I1[:,None],J1[:,None],I1[None,:],J1[None,:]]*np.outer(c,c)
    Kg=K1+np.pi*K2
    w,V=np.linalg.eigh(Kg)
    a1=np.einsum('ik,ij,jk->k',V,K1,V); a2=np.einsum('ik,ij,jk->k',V,K2,V)
    pairs={}
    for x,y in zip(np.round(a1,6),np.round(a2,6)):
        pairs[(x,y)]=pairs.get((x,y),0)+1
    return pairs

def masses(case,N,mu2=1.7,l1=0.3,l2=0.8,eps=1e-4):
    """numerical Hessian of V in the radial directions: returns (f^2, m_h^2, set of m_H^2) vs formulas"""
    n,p,h,Om=coset(case,N); D=len(p)
    f2=2*mu2/(n*l1+l2); f0=np.sqrt(f2)
    def V(r):
        Phi=f0*np.eye(n)+2*np.einsum('a,aij->ij',r,np.array(p))
        H=Phi/np.sqrt(2) if case!='III' else Phi@Om/np.sqrt(2)
        M=H.conj().T@H
        return (-(mu2/2)*np.trace(M)+(l1/4)*np.trace(M)**2+(l2/4)*np.trace(M@M)).real
    grad=np.array([(V(eps*np.eye(D)[i])-V(-eps*np.eye(D)[i]))/(2*eps) for i in range(D)])
    Hs=np.zeros((D,D))
    for i in range(D):
        for j in range(D):
            ei=eps*np.eye(D)[i]; ej=eps*np.eye(D)[j]
            Hs[i,j]=(V(ei+ej)-V(ei-ej)-V(-ei+ej)+V(-ei-ej))/(4*eps**2)
    w=np.linalg.eigvalsh(Hs)
    return np.abs(grad).max(), Hs[0,0], (n*l1+l2)*f2, np.unique(np.round(w[1:] if False else np.delete(np.diag(Hs),0),5)), l2*f2

if __name__=='__main__':
    print('(0) isotropic ansatz of the draft: max|dd - ansatz|, max|ff - Ct(dd-dd)|')
    for N in (2,3,4): print('   N=%d'%N, check_ansatz(N))
    for case in ('I','II','III'):
        for N in (2,3,4):
            if case=='III' and N==4: pass
            n,p,h,_=coset(case,N); d,f=structure(p,h)
            g=check_gauss(d,f)
            kin=check_kinetic(case,N)
            gs=growth_sampled(case,N,('h','H'))
            gr_all=growth(case,N,('h','H')); gr_h=growth(case,N,('h',)); gr_none=growth(case,N,())
            K=sectional(case,N)
            print(f'case {case:3s} N={N}: dim p={len(p)-1}+1, dim h={len(h)}, Gauss resid={g:.1e}, kinetic resid={kin:.1e}, '
                  f'O(s) coeff (sampled amplitudes, all modes)={gs:.1e}; Gauss residual: all={gr_all:.1e} only-h={gr_h:.2e} none={gr_none:.2e}; sect.curv. range=[{K[0]:.3f},{K[1]:.3f}]  '
                  f'|d_abc|max={np.abs(d[1:,1:,1:]).max():.3f} coupling h: {d[1,1,0]:.4f} (sqrt(2/n)={np.sqrt(2/n):.4f})')
    print('(6a) radial masses: |dV|, m_h^2 (num), (n l1+l2) f^2, m_H^2 (num), l2 f^2')
    for case,N in (('I',3),('II',3),('III',3)): print('  ',case,N,masses(case,N))
    print('(6) unitarity eigenvalues  a*lambda1 + b*lambda2 : multiplicity')
    for case,N in (('I',2),('I',3),('I',4),('II',3),('II',4),('III',2),('III',3)):
        print('  ',case,N,unitarity(case,N))
