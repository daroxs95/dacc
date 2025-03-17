
interface CompanyFormProps {
    title: string;
    company: Company;
    setCompany: (newCompany: Company) => void;
}

export default function CompanyForm({company, setCompany, title = "Compañía"}: CompanyFormProps) {
    return (
        <details className="card p-0 no-shadow">
            <summary>
                <h4>{title}</h4>
            </summary>
            <div className="hstack f-wrap p-def">
                <div className="f-column vstack f-grow">
                    <label>Nombre</label>
                    <input value={company?.name}
                           onChange={(e) => setCompany({...company, name: e.target.value})}/>
                </div>
                <div className="f-column vstack f-grow">
                    <label>Dirección</label>
                    <input value={company?.address}
                           onChange={(e) => setCompany({...company, address: e.target.value})}/>
                </div>
                <div className="f-column vstack f-grow">
                    <label>Ciudad</label>
                    <input value={company?.city}
                           onChange={(e) => setCompany({...company, city: e.target.value})}/>
                </div>
                <div className="f-column vstack f-grow">
                    <label>País</label>
                    <input value={company?.country}
                           onChange={(e) => setCompany({...company, country: e.target.value})}/>
                </div>
                <div className="f-column vstack f-grow">
                    <label>Email</label>
                    <input value={company?.email}
                           onChange={(e) => setCompany({...company, email: e.target.value})}/>
                </div>
                <div className="f-column vstack f-grow">
                    <label>Código postal</label>
                    <input value={company?.postalCode}
                           onChange={(e) => setCompany({...company, postalCode: e.target.value})}/>
                </div>
            </div>
        </details>
    );
}
