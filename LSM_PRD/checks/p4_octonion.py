"""Point 4: the exceptional member E6/F4 (Jordan algebra J3(O), 26 NGBs).
Generic Jordan-algebra machinery for J3(K), K = R, C, H, O (Hermitian 3x3 over K, Jordan product X o Y = (XY+YX)/2,
trace form <X,Y> = Re tr(X o Y)). We check:
  (a) Jordan identity, associativity of the trace form;
  (b) Der(J): dimension (so(3)=3, su(3)=8, sp(6)=21, f4=52);
  (c) the Jordan form of Lemma 1:  F^{ABCD} = d^{ACE}d^{BDE} - d^{ADE}d^{BCE},
      with d^{ABC}=4<X^A o X^B, X^C>, F^{ABCD} = -8 <[L_A,L_B] X^C, X^D>   (normalization calibrated on K=C, R);
  (d) Sym^2(R_pi) decomposition under Der(J): expect 1+26+324 for F4 (three irreps => N=3 rigidity applies);
  (e) the linear completion 27 of E6 (e6 = Der(J) + i L(J_0)) with vev = identity: Gauss holds, radial 1+26;
  (f) rank 2 (flat planes) and C_d, Kbar."""
import numpy as np, itertools
from scipy.linalg import null_space
from p2_realize import analyse
np.set_printoptions(precision=5,suppress=True,linewidth=150)

# ---------- Cayley-Dickson algebras: R(1), C(2), H(4), O(8) as real vectors ----------
def conj(x):
    y=-x.copy(); y[0]=x[0]; return y
def mult(x,y):
    n=len(x)
    if n==1: return x*y
    h=n//2; a,b=x[:h],x[h:]; c,d=y[:h],y[h:]
    # (a,b)(c,d) = (ac - d* b, d a + b c*)
    return np.concatenate([mult(a,c)-mult(conj(d),b), mult(d,a)+mult(b,conj(c))])

class J3:
    def __init__(s,k):
        s.k=k   # dim of K
        s.dim=3+3*k
    def to_mat(s,v):
        k=s.k; M=[[None]*3 for _ in range(3)]
        for i in range(3):
            e=np.zeros(k); e[0]=v[i]; M[i][i]=e
        offs=[(0,1),(0,2),(1,2)]
        for n,(i,j) in enumerate(offs):
            z=v[3+n*k:3+(n+1)*k]; M[i][j]=z.copy(); M[j][i]=conj(z)
        return M
    def from_mat(s,M):
        k=s.k; v=np.zeros(s.dim)
        for i in range(3): v[i]=M[i][i][0]
        for n,(i,j) in enumerate([(0,1),(0,2),(1,2)]): v[3+n*k:3+(n+1)*k]=M[i][j]
        return v
    def prod(s,A,B):
        k=s.k; return [[sum((mult(A[i][l],B[l][j]) for l in range(3)),np.zeros(k)) for j in range(3)] for i in range(3)]
    def jordan(s,x,y):
        A,B=s.to_mat(x),s.to_mat(y)
        P=s.prod(A,B); Q=s.prod(B,A)
        return s.from_mat([[0.5*(P[i][j]+Q[i][j]) for j in range(3)] for i in range(3)])
    def tr(s,x): return x[0]+x[1]+x[2]

def setup(k):
    J=J3(k); n=J.dim
    E=np.eye(n)
    # structure constants of Jordan product in coordinate basis
    C=np.zeros((n,n,n))
    for a in range(n):
        for b in range(n):
            C[a,b]=J.jordan(E[a],E[b])
    # trace form in coordinate basis
    G=np.array([[J.tr(C[a,b]) for b in range(n)] for a in range(n)])
    # orthonormal basis X^0 = 1/sqrt(6), rest traceless, <X,X>=1/2
    one=np.array([1,1,1]+[0]*(3*k),float)
    basis=[one/np.sqrt(2*3)]
    for v in E:
        w=v.copy()
        for b in basis: w-= (w@G@b)/(b@G@b)*b
        nrm=w@G@w
        if nrm>1e-10: basis.append(w/np.sqrt(2*nrm))
    B=np.array(basis)            # rows: X^A in coordinates
    jo=lambda x,y: np.einsum('a,b,abc->c',x,y,C)
    ip=lambda x,y: x@G@y
    D=n
    d=np.array([[[4*ip(jo(B[A],B[Bb]),B[Cc]) for Cc in range(D)] for Bb in range(D)] for A in range(D)])
    # L_A as matrices in the X-basis: L_A X^B = sum_C L[A][C,B] X^C, coefficient = 2<.,X^C>
    L=np.array([[[2*ip(jo(B[A],B[Bb]),B[Cc]) for Bb in range(D)] for Cc in range(D)] for A in range(D)])
    return J,B,C,G,d,L,jo,ip

def run(k,label,full=True):
    J,B,C,G,d,L,jo,ip=setup(k); D=len(B)
    # (a) Jordan identity and associativity of trace form
    rng=np.random.default_rng(0); x,y,z=rng.normal(size=(3,D)) @ B
    jid=np.abs(jo(jo(x,y),jo(x,x))-jo(x,jo(y,jo(x,x)))).max()
    assoc=abs(ip(jo(x,y),z)-ip(x,jo(y,z)))
    # (c) Lemma in Jordan form
    F=np.zeros((D,D,D,D))
    for A_ in range(D):
        for B_ in range(D):
            comm=L[A_]@L[B_]-L[B_]@L[A_]
            F[A_,B_]=-8*0.5*comm.T          # <[L_A,L_B]X^C,X^D> = 1/2 comm[D,C]
    rhs=np.einsum('ace,bde->abcd',d,d)-np.einsum('ade,bce->abcd',d,d)
    lem=np.abs(F-rhs).max()
    Fs=F[1:,1:,1:,1:]; Dp=D-1
    Rs=np.einsum('abab',Fs)
    ds=d[1:,1:,1:]; Cd=np.einsum('acd,acd',ds,ds)/Dp
    sec=[Fs[a,b,a,b] for a in range(Dp) for b in range(a+1,Dp)]
    print(f'== J3({label}): dim J={D}, Jordan identity resid={jid:.1e}, trace-form assoc resid={assoc:.1e}')
    print(f'   d^(ab0)={d[1,1,0]:.5f} (sqrt(2/3)={np.sqrt(2/3):.5f});  Lemma (Jordan form) resid={lem:.2e}')
    print(f'   scalar curvature R={Rs:.4f}, Kbar=R/(D(D-1))={Rs/(Dp*(Dp-1)):.5f}, C_d={Cd:.5f}, sectional curvature range=[{min(sec):.4f},{max(sec):.4f}]')
    if not full: return
    # (b) derivations: solve D(XoY)=DX o Y + X o DY in coordinate basis
    n=D; Cc=C
    rows=[]
    I=np.eye(n)
    # unknown Dm (n x n), vec index p*n+q for Dm[p,q] (D e_q = sum_p Dm[p,q] e_p)
    M=np.zeros((n*n*n, n*n))
    for a in range(n):
        for b in range(n):
            # D(e_a o e_b) = sum_e C[a,b,e] D e_e ; component p: sum_e C[a,b,e] Dm[p,e]
            # DX o Y : sum_q Dm[q,a] C[q,b,p] ; X o DY : sum_q Dm[q,b] C[a,q,p]
            for p in range(n):
                row=np.zeros((n,n))
                row[p,:]+=Cc[a,b,:]
                row[:,a]-=Cc[:,b,p]
                row[:,b]-=Cc[a,:,p]
                M[(a*n+b)*n+p]=row.ravel()
    ns=null_space(M,rcond=1e-9)
    print(f'   dim Der(J) = {ns.shape[1]}')
    Ders=[ns[:,i].reshape(n,n) for i in range(ns.shape[1])]
    # convert to X-basis: coords x = B^T c  (c in X-basis) ; Dm acts on coords
    Binv=np.linalg.pinv(B.T)
    DX=[Binv@Dm@B.T for Dm in Ders]     # matrices acting on X-basis coefficients
    # restrict to traceless part (index 1..)
    hp=[Dx[1:,1:] for Dx in DX]
    # orthonormalize w.r.t. the invariant form -Tr(h h) (Casimir needs an orthonormal basis)
    Kt=np.array([[-np.trace(a_@b_) for b_ in hp] for a_ in hp]); wk,Ok=np.linalg.eigh(Kt)
    hp=[sum(Ok[i,k]*hp[i] for i in range(len(hp)))/np.sqrt(wk[k]) for k in range(len(hp))]
    print(f'   derivations kill identity: {max(np.abs(Dx[:,0]).max() for Dx in DX):.1e}; antisymmetric: {max(np.abs(h+h.T).max() for h in hp):.1e}')
    # (d) Casimir on Sym^2(R_pi)
    Dp=D-1; Iq=np.eye(Dp)
    S=[]
    for a in range(Dp):
        for b in range(a,Dp):
            v=np.zeros((Dp,Dp)); v[a,b]+=1; v[b,a]+=1; S.append((v/np.linalg.norm(v)).ravel())
    S=np.array(S).T
    Cas=np.zeros((S.shape[1],S.shape[1]))
    for h in hp:
        Gm=np.kron(h,Iq)+np.kron(Iq,h); GS=S.T@Gm@S; Cas-=GS@GS
    w=np.linalg.eigvalsh((Cas+Cas.T)/2)
    vals=[]
    for x in w:
        if not any(abs(x-y)<1e-6*max(1,abs(x)) for y,_ in vals): vals.append((x,0))
    mult_=[(x,int(np.sum(np.abs(w-x)<1e-6*max(1,abs(x))))) for x,_ in vals]
    print(f'   Sym^2(R_pi) irreps (Casimir, dim): {[(round(x,4),m) for x,m in mult_]}')
    # rigidity data: T_R onto A and F
    A=(np.einsum('ac,bd->abcd',Iq,Iq)-np.einsum('ad,bc->abcd',Iq,Iq))
    Bm=np.array([A.ravel(),Fs.ravel()]).T
    Wv,V=np.linalg.eigh((Cas+Cas.T)/2)
    out=[]
    for x,dm in mult_:
        cols=V[:,np.abs(Wv-x)<1e-6*max(1,abs(x))]; P=(S@cols)@(S@cols).T; P4=P.reshape(Dp,Dp,Dp,Dp)
        T=(np.einsum('acbd->abcd',P4)-np.einsum('adbc->abcd',P4)).ravel()
        co=np.linalg.lstsq(Bm,T,rcond=None)[0]; out.append((dm,co,np.abs(Bm@co-T).max()))
    for dm,co,r in out: print(f'      T_R(dim {dm}) = {co[0]:+.5f} A {co[1]:+.5f} F   (resid {r:.1e})')
    print(f'   minimal solution expected (c1,c_pi)=(2D/n, C_d)=({2*Dp/3:.4f},{Cd:.4f}); null direction (1+D/2,1,1)=({1+Dp/2},1,1)')
    # (e) linear completion: complex J (the 27 of E6 for K=O), gens: derivations (X=-i D) and L_a (a>=1)
    gens=[-1j*Dx for Dx in DX]+[L[a].astype(complex) for a in range(1,D)]
    v=np.zeros(D,complex); v[0]=1.0
    analyse(gens,v,f'linear completion of J3({label}) complexified, vev = identity')

if __name__=='__main__':
    run(1,'R'); run(2,'C'); run(4,'H'); run(8,'O')
