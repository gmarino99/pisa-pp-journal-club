"""Point 2: realizability of non-minimal Gauss solutions.
Generic engine: given Hermitian generators acting on a complex vector space V (as rep images),
split into broken/unbroken at vev v, compute
  - metric f^2 from tangent vectors t_a v   (t_a = i*X_a acting on V, real inner product Re<.,.>)
  - curvature F^{abcd} = -(t_c v).([[t_a,t_b],t_d] v)/f^2   (intrinsic, Lie-algebraic)
  - second fundamental form g^r_ab = -(1/2f) n_r.{t_a,t_b} v
  - Gauss residual F - (G_ac,bd - G_ad,bc)
  - decomposition of the normal couplings into H-irreps, c_R and which Sym^2(R_pi) irreps they hit.
"""
import numpy as np, itertools
from scipy.linalg import null_space, orth
np.set_printoptions(precision=4,suppress=True,linewidth=150)

def rinner(x,y): return np.real(np.vdot(x,y))

def analyse(gens, v, label, tol=1e-9):
    """gens: list of Hermitian matrices acting on C^dimV (Lie algebra basis, any normalization consistent
    with the abstract algebra); v: complex vector."""
    V=len(v); G=len(gens)
    # real embedding
    def R(z): return np.concatenate([z.real,z.imag])
    act=[1j*g for g in gens]                       # t = i X  (anti-Hermitian => real antisymmetric)
    imgs=np.array([R(t@v) for t in act]).T         # 2V x G
    # unbroken = null space of imgs ; broken = orthogonal complement w.r.t. Killing-like metric
    # use metric K_ij = Tr(X_i X_j) on the given generators (they must be orthonormal-ish)
    K=np.array([[np.real(np.trace(a@b)) for b in gens] for a in gens])
    U=null_space(imgs)                             # coefficients of unbroken generators
    # broken: K-orthogonal complement of U
    Bc=null_space(U.T@K)
    Tun=[sum(c[i]*gens[i] for i in range(G)) for c in U.T]
    # orthonormalize unbroken generators w.r.t. Tr_V (needed for a correct Casimir)
    Kt=np.array([[np.real(np.trace(a_@b_)) for b_ in Tun] for a_ in Tun])
    wk,Ok=np.linalg.eigh(Kt)
    Tun=[sum(Ok[i,k]*Tun[i] for i in range(len(Tun)))/np.sqrt(wk[k]) for k in range(len(Tun))]
    Tbr=[sum(c[i]*gens[i] for i in range(G)) for c in Bc.T]
    # orthonormalize broken generators wrt the metric of tangent vectors (canonical NGBs)
    tv=np.array([R(1j*X@v) for X in Tbr]).T
    M=tv.T@tv
    w,O=np.linalg.eigh(M)
    f2=w.mean(); 
    iso=np.abs(w-f2).max()/f2
    Tbr=[sum(O[i,k]*Tbr[i] for i in range(len(Tbr)))*np.sqrt(f2/w[k]) for k in range(len(Tbr))]  # equal norm f^2
    D=len(Tbr); f=np.sqrt(f2)
    tb=[1j*X for X in Tbr]; tu=[1j*X for X in Tun]
    tvec=np.array([R(t@v) for t in tb]).T          # tangent basis (norm f)
    # curvature
    F=np.zeros((D,D,D,D))
    for a in range(D):
        for b in range(D):
            cab=tb[a]@tb[b]-tb[b]@tb[a]
            for dd in range(D):
                w_=R((cab@tb[dd]-tb[dd]@cab)@v)
                F[a,b,:,dd]=-tvec.T@w_/f2   # sign: t=iX gives R(X,Y)Z=-[[X,Y],Z]
    # normal space projector
    Qt,_=np.linalg.qr(tvec)
    Pn=np.eye(2*V)-Qt@Qt.T
    W=np.zeros((D,D,2*V))
    for a in range(D):
        for b in range(D):
            W[a,b]=-(1/(2*f))*Pn@R((tb[a]@tb[b]+tb[b]@tb[a])@v)
    Gt=np.einsum('abr,cdr->abcd',W,W)               # G^{ab,cd}
    gauss=F-(np.einsum('acbd->abcd',Gt)-np.einsum('adbc->abcd',Gt))
    # H action on the normal space and on p
    hn=[]
    for t in tu: hn.append(Pn@np.block([[np.real(t),-np.imag(t)],[np.imag(t),np.real(t)]])@Pn)
    # H action on tangent coords (adjoint on p)
    hp=[]
    for t in tu:
        m=np.zeros((D,D))
        for a in range(D):
            cm=t@tb[a]-tb[a]@t
            m[:,a]=tvec.T@R(cm@v)/f2
        hp.append(m)
    # decompose the span of normal couplings into Casimir eigenspaces
    span=orth(W.reshape(D*D,2*V).T)                 # basis of image of 2nd fundamental form
    Cn=-sum(h_@h_ for h_ in hn)
    # Casimir eigenspaces on the H-invariant span (span is H-invariant)
    Cs=span.T@Cn@span; Cs=(Cs+Cs.T)/2
    ev,EV=np.linalg.eigh(Cs)
    groups={}
    for k,x in enumerate(ev):
        key=round(x,5); groups.setdefault(key,[]).append(k)
    res=[]
    A=(np.einsum('ac,bd->abcd',np.eye(D),np.eye(D))-np.einsum('ad,bc->abcd',np.eye(D),np.eye(D)))
    Bm=np.array([A.ravel(),F.ravel()]).T
    for key,ks in sorted(groups.items()):
        basis=span@EV[:,ks]
        Wr=np.einsum('abr,rk->abk',W,basis)
        Gr=np.einsum('abk,cdk->abcd',Wr,Wr)
        Tr=np.einsum('acbd->abcd',Gr)-np.einsum('adbc->abcd',Gr)
        co=np.linalg.lstsq(Bm,Tr.ravel(),rcond=None)[0]
        res.append((len(ks),key,co))
    # Sym^2(p) Casimir values for reference
    print(f'== {label}: dim V(real)={2*V}, dim g={G}, dim h={len(Tun)}, dim p={D}, metric isotropy={iso:.1e}, f^2={f2:.4f}')
    print(f'   Gauss residual = {np.abs(gauss).max():.2e}   |F| = {np.abs(F).max():.3f}')
    print(f'   normal space dim = {2*V-D}; image of 2nd fundamental form dim = {span.shape[1]}')
    for dimR,cas,co in res:
        print(f'   radial irrep coupled to pi pi: dim={dimR:4d} Casimir(normal)={cas:8.4f}   contribution to Gauss = {co[0]:+.4f} A {co[1]:+.4f} F')
    return F,W

# ---------- helpers ----------
def herm_basis_traceless(n):
    B=[]
    for i in range(n):
        for j in range(i+1,n):
            M=np.zeros((n,n),complex); M[i,j]=M[j,i]=1; B.append(M/2)
            M=np.zeros((n,n),complex); M[i,j]=-1j; M[j,i]=1j; B.append(M/2)
    for k in range(1,n):
        M=np.zeros((n,n),complex)
        for i in range(k): M[i,i]=1
        M[k,k]=-k; B.append(M/np.sqrt(2*k*(k+1)))
    return B   # Tr = 1/2 normalization

def wedge_rep(X,k):
    n=X.shape[0]; subs=list(itertools.combinations(range(n),k)); idx={s:i for i,s in enumerate(subs)}
    M=np.zeros((len(subs),len(subs)),complex)
    for col,s in enumerate(subs):
        for pos in range(k):
            for j in range(n):
                if X[j,s[pos]]==0: continue
                new=list(s); new[pos]=j
                if len(set(new))<k: continue
                perm=np.argsort(new); sign=np.linalg.det(np.eye(k)[perm]) 
                M[idx[tuple(sorted(new))],col]+=X[j,s[pos]]*round(sign)
    return M, subs

if __name__=='__main__':
    # (A) sanity: minimal matrix model of SU(3)xSU(3)/SU(3): V = Mat(3,C), (L,R): psi -> L psi R^dag
    def chiral(R_of, dimR, label):
        T=herm_basis_traceless(R_of)
        gens=[]
        I=np.eye(dimR)
        for X in T:
            XR=X if R_of==dimR else rep(X)
            gens.append(np.kron(XR,I))            # left action on psi (row-major vec: psi_ij -> X_ik psi_kj)
        for X in T:
            XR=X if R_of==dimR else rep(X)
            gens.append(-np.kron(I,XR.T))         # right action psi -> - psi X  (R^dag with R=e^{iX})
        v=np.eye(dimR).ravel().astype(complex)
        return analyse(gens,v,label)
    rep=None
    chiral(3,3,'SU(3)xSU(3) minimal (3,3bar)  [sanity: expect 1+8, Gauss=0]')
    # (B) SU(3)xSU(3) via adjoint (8,8): psi -> L8 psi R8^dag  (complex 8x8)
    T3=herm_basis_traceless(3)
    def adj3(X):
        return np.array([[2*np.trace(T3[a]@(X@T3[b]-T3[b]@X)) for b in range(8)] for a in range(8)])
    rep=adj3
    chiral(3,8,'SU(3)xSU(3) via (8,8)  [rigidity N=3: expect the 8 to appear]')
    # (C) SU(4)xSU(4) via (6,6bar), 6 = Lambda^2 4
    def lam2(X): return wedge_rep(X,2)[0]
    rep=lam2
    chiral(4,6,'SU(4)xSU(4) via (6,6)  [expect radial 1+20prime only]')
    # (D) SU(4)/SO(4) via 20' : use SU(4) acting on Sym^2 of the 6 (Lambda^2), complex symmetric 6x6 ... simpler: SO(6) on sym traceless real 6x6
    # build so(6) generators normalized like SU(4) images: X = i*J, Tr_6(X X) = 1
    gens6=[]
    for i in range(6):
        for j in range(i+1,6):
            J=np.zeros((6,6)); J[i,j]=1; J[j,i]=-1
            gens6.append(1j*J/np.sqrt(2))       # Tr(X X) = 1
    # action on symmetric 6x6: S -> X S - S X   (S -> O S O^T)
    def act_sym(X):
        n=6; return np.kron(X,np.eye(n))-np.kron(np.eye(n),X.T)
    gens=[act_sym(X) for X in gens6]
    v=np.diag([1,1,1,-1,-1,-1]).astype(complex).ravel()
    analyse(gens,v,'SU(4)/SO(4) = SO(6)/SO(3)xSO(3) via 20prime  [expect radial 1+5L+5R]')
    # (E) SU(8)/Sp(8) via Lambda^4 8
    T8=herm_basis_traceless(8)
    reps=[wedge_rep(X,4)[0] for X in T8]
    subs=wedge_rep(T8[0],4)[1]
    # omega = sum_i e_i ^ e_{i+4};  omega^omega = 2 sum_{i<j} e_i e_{i+4} e_j e_{j+4}
    vec=np.zeros(len(subs),complex); idx={s:k for k,s in enumerate(subs)}
    for i in range(4):
        for j in range(i+1,4):
            new=[i,i+4,j,j+4]; perm=np.argsort(new); sign=round(np.linalg.det(np.eye(4)[perm]))
            vec[idx[tuple(sorted(new))]]+=2*sign
    analyse(reps,vec,'SU(8)/Sp(8) via Lambda^4 (70)  [expect radial 1+42]')
    # (F) N=5 control: SU(5)xSU(5) via (10,10bar), 10 = Lambda^2 5 (complex, anomaly N-4=1)
    rep=lam2
    chiral(5,10,'SU(5)xSU(5) via (10,10bar)  [control: adjoint expected since A(Lambda^2)=N-4!=0]')
