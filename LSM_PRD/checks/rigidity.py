"""
(7) Rigidity of the linear completion.
For the NGB sector pi^a (a>=1, eta excluded), any radial multiplet rho_R in an H-irrep R couples
to pi pi only through an H-invariant map Sym^2(p) -> R. If Sym^2(p) is multiplicity free, the
s-growth cancellation (Gauss equation) reads   f f = sum_R c_R^2 T_R ,  c_R^2 >= 0,
T_R[abcd] = P_R[(ac),(bd)] - P_R[(ad),(bc)]. We find all solutions.
Also (8): verify the closed form of the NLSM amplitude.
"""
import numpy as np, itertools
from verify import coset, structure, amp
np.set_printoptions(precision=4, suppress=True, linewidth=160)

def analyse(case,N):
    n,p,h,_=coset(case,N); d,f=structure(p,h)
    ds=d[1:,1:,1:]; fs=f[1:,1:,:]; D=ds.shape[0]; K=fs.shape[2]
    # adjoint action of h on p': [T_i, X_a] = i f_{i a b} X_b ; f_{iab} = -2i Tr([T_i,X_a] X_b)
    t=np.zeros((K,D,D))
    for i in range(K):
        for a in range(D):
            cm=h[i]@p[a+1]-p[a+1]@h[i]
            for b in range(D): t[i,b,a]=(-2j*np.trace(cm@p[b+1])).real
    I=np.eye(D)
    # symmetric subspace basis
    S=[]
    for a in range(D):
        for b in range(a,D):
            v=np.zeros((D,D)); v[a,b]+=1; v[b,a]+=1; S.append((v/np.linalg.norm(v)).ravel())
    S=np.array(S).T   # D^2 x Dsym
    C=np.zeros((D*D,D*D))
    for i in range(K):
        G=np.kron(t[i],I)+np.kron(I,t[i]); C-=G@G
    Cs=S.T@C@S
    w,V=np.linalg.eigh((Cs+Cs.T)/2)
    vals=[]; 
    for x in w:
        if not any(abs(x-y)<1e-6 for y in vals): vals.append(x)
    Ts=[]; dims=[]
    for x in vals:
        cols=V[:,np.abs(w-x)<1e-6]; dims.append(cols.shape[1])
        P=(S@cols)@(S@cols).T            # projector on D^2 space
        P4=P.reshape(D,D,D,D)            # P[(a,b),(c,e)] -> P4[a,b,c,e]
        T=np.einsum('acbd->abcd',P4)-np.einsum('adbc->abcd',P4)
        Ts.append(T.ravel())
    Ts=np.array(Ts).T
    ff=np.einsum('abi,cdi->abcd',fs,fs).ravel()
    sol,res,rank,sv=np.linalg.lstsq(Ts,ff,rcond=None)
    resid=np.abs(Ts@sol-ff).max()
    # null space
    U,sv,Vt=np.linalg.svd(Ts,full_matrices=False); null=Vt[np.sum(sv>1e-9*sv[0]):]
    # Jordan solution projected: which irreps does dd use?
    # Jordan solution: the one with c_R=0 outside {singlet, R_pi}; shift along null vector
    nv=null[0]/null[0][0]*(1+D/2)
    # pick kappa so that min over R not in {1, R_pi(dim D)} of c_R is zero
    others=[k for k,dm in enumerate(dims) if dm not in (1,D)]
    if others:
        kap=max(-sol[k]/nv[k] for k in others)
        J=sol+kap*nv
    else: J=sol
    return dims, np.round(vals,4), np.round(J,5), resid, rank, np.round(nv,4)

for case,N in (('I',3),('I',4),('II',3),('II',4),('III',3)):
    dims,vals,sol,resid,rank,null=analyse(case,N)
    print(f'case {case} N={N}: irreps in Sym^2(p) dims={dims} Casimirs={vals}')
    print(f'     minimal (Jordan) solution c_R^2={sol}  resid={resid:.1e}  rank(T)={rank}  null direction (normalised to 1+D/2 on singlet)={null}')

# (8) closed form of NLSM amplitude: M = (1/f^2)[ s d_abE d_cdE + t d_acE d_bdE + u d_adE d_bcE ]
#     = -(1/f^2)[ t f_adI f_bcI + u f_acI f_bdI ]   (eta excluded; a,b -> c,d ; t=(p_a-p_c)^2)
rng=np.random.default_rng(5)
for case,N in (('I',3),('II',4),('III',3)):
    n,p,h,_=coset(case,N); d,f=structure(p,h); D=len(p)
    err=0
    for _ in range(50):
        a,b,c,e=rng.integers(1,D,size=4); s=1.3; t=-0.4
        Mc=amp(d,f,1.0,a,b,c,e,s,t,1,1,keep=())
        u=-s-t
        F1=-(t*np.dot(f[a,e],f[b,c])+u*np.dot(f[a,c],f[b,e]))
        F2=s*np.dot(d[a,b],d[c,e])+t*np.dot(d[a,c],d[b,e])+u*np.dot(d[a,e],d[b,c])
        err=max(err,abs(Mc-F1),abs(Mc-F2))
    print('closed form NLSM amplitude check',case,N,err)
