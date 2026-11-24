"""Tree-level unitarity region in (m_h/f, m_H/f) for N=3, from the eigenvalues of the
quartic-coupling matrix (see verify.py, item 6):  |e| <= 8 pi  for every channel.
   lambda1 = (m_h^2 - m_H^2)/(n f^2),  lambda2 = m_H^2/f^2."""
import numpy as np, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
cases={  # n, D_R, list of b (eigenvalue 2 l1 + b l2), singlet c_s
 r'$SU(3)\times SU(3)/SU(3)$': (3, 18, [-2,0,2,6], 12),
 r'$SU(3)/SO(3)$':             (3, 12, [-1,0,2,5], 8),
 r'$SU(6)/Sp(6)$':             (6, 30, [-2,0,1,4], 10),
}
x=np.linspace(0.01,4,800); X,Y=np.meshgrid(x,x)
plt.rcParams.update({'font.size':10,'font.family':'serif','mathtext.fontset':'cm'})
fig,ax=plt.subplots(figsize=(3.4,3.1))
cols=['#2a78d6','#eb6834','#1baf7a']; ls=['-','--',':']
for (lab,(n,DR,bs,cs)),c,l in zip(cases.items(),cols,ls):
    l1=(X**2-Y**2)/n; l2=Y**2
    ok=np.abs((DR+2)*l1+cs*l2)<=8*np.pi
    for b in bs: ok&=np.abs(2*l1+b*l2)<=8*np.pi
    ax.contourf(X,Y,ok.astype(float),levels=[0.5,1.5],colors=[c],alpha=0.12)
    cs_=ax.contour(X,Y,ok.astype(float),levels=[0.5],colors=[c],linewidths=2,linestyles=l)
    ax.plot([],[],color=c,lw=2,ls=l,label=lab)
ax.set_xlabel(r'$m_h/f$'); ax.set_ylabel(r'$m_H/f$')
ax.set_xlim(0,3); ax.set_ylim(0,3)
ax.grid(color='#dddddd',lw=0.5); ax.set_axisbelow(True)
for s in ('top','right'): ax.spines[s].set_visible(False)
ax.legend(frameon=False,fontsize=8,loc='upper right')
fig.tight_layout(); fig.savefig('/home/user/pisa-pp-journal-club/LSM_PRD/figures/unitarity_N3.pdf'); fig.savefig('/tmp/claude-0/unit.png',dpi=150)
