import type {Route} from "./+types/home";
import {Invoice} from "~/components/Invoice/Invoice";
import styles from "./home.module.css";
import {useEffect, useState} from "react";
import {Navbar} from "~/components/Navbar/Navbar";
import CompanyForm from "~/components/CompanyForm/CompanyForm";
import type {Lang} from "~/hooks/useLang";

export function meta({}: Route.MetaArgs) {
    return [
        {title: "Dacc, simple invoicing"},
        {name: "description", content: "Invoicing made simple with Dacc"},
    ];
}

type Data = {
    profiles: Profile[];
}

type Profile = {
    id: string;
    invoiceNumber: string;
    created: string;
    due: string;
    description: string;
    quantity: number;
    rate: number;
    showLogo: boolean;
    company: Company;
    companyToBill: Company;
    language: Lang;
}

export default function Home() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
    const [profileName, setProfileName] = useState("");

    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [created, setCreated] = useState("");
    const [due, setDue] = useState("");
    const [description, setDescription] = useState("");
    const [quantity, setQuantity] = useState(0);
    const [rate, setRate] = useState(0);
    const [showLogo, setShowLogo] = useState(true);
    const [language, setLanguage] = useState<Lang>("es");

    const [company, setCompany] = useState({
        name: "Example Company",
        address: "1234 Main St",
        city: "Springfield",
        country: "USA",
        email: "example@example.com",
        postalCode: "12345"
    });

    const [companyToBill, setCompanyToBill] = useState({
        name: "Example Company",
        address: "1234 Main St",
        city: "Springfield",
        country: "USA",
        email: "example@example.com",
        postalCode: "12345"
    });

    const [paid, setPaid] = useState(false);

    const saveToLocalStorage = () => {
        const newProfile = {
            id: profileName,
            invoiceNumber,
            created,
            due,
            description,
            company,
            showLogo,
            quantity,
            rate,
            companyToBill,
            language,
        }
        const rest = profiles.filter(p => p.id !== selectedProfile);
        localStorage.setItem("data", JSON.stringify(
            {
                profiles: [...rest, newProfile]
            }
        ));
    }

    useEffect(() => {
        try {
            const data = localStorage.getItem("data");
            if (!data) return;
            const parsed: Data = JSON.parse(data);
            if (!parsed || !parsed.profiles) return;
            setProfiles(parsed.profiles);
        } catch (e) {
            console.error(e)
        }
    }, []);

    useEffect(() => {
        if (!profiles.length) return;
        const selected = profiles.find(p => p.id === selectedProfile);
        if (!selected) return;
        setInvoiceNumber(selected.invoiceNumber);
        setCreated(selected.created);
        setDue(selected.due);
        setDescription(selected.description);
        setCompany(selected.company);
        setShowLogo(selected.showLogo);
        setQuantity(selected.quantity);
        setRate(selected.rate);
        setCompanyToBill(selected.companyToBill);
        setLanguage(selected.language)
    }, [profiles, selectedProfile]);

    return (
        <>
            <Navbar/>
            <br/>
            <div className={`${styles.controls} w-100 m-auto noPrint vstack`}>
                <details className="card p-0 no-shadow">
                    <summary>
                        <h4>Perfil</h4>
                    </summary>

                    <div className="hstack f-wrap p-def">
                        <div className="f-column vstack f-grow">
                            <label>Perfil</label>
                            <select onChange={(e) => {
                                setSelectedProfile(e.currentTarget.value);
                                setProfileName(e.currentTarget.value);
                            }}>
                                <option value="nuevo">Nuevo</option>
                                {profiles.map(p => (
                                    <option key={p.id} value={p.id}>{p.id}</option>
                                ))}
                            </select>
                        </div>
                        <div className="f-column vstack f-grow">
                            <label>Nombre</label>
                            <input value={profileName} onChange={(e) => setProfileName(e.target.value)}/>
                        </div>
                        <div className="f-column vstack f-grow">
                            <label>Idioma</label>
                            <select value={language} onChange={(e) => {
                                setLanguage(e.currentTarget.value as Lang);
                            }}>
                                <option value="es">Español</option>
                                <option value="en"> English</option>
                            </select>
                        </div>
                    </div>

                    <div className="hstack f-wrap p-def">
                        <div className="f-column vstack">
                            <button onClick={() => {
                                const data = localStorage.getItem("data");
                                if (!data) return;
                                // copy to clipboard
                                try {
                                    navigator.clipboard.writeText(data);
                                    alert("Data copied to clipboard");
                                } catch (e) {
                                    console.error(e);
                                }
                            }}>
                                Copy data
                            </button>
                        </div>
                        <div className="f-column vstack">
                            <button onClick={() => {
                                const data = prompt("Paste data here");
                                if (!data) return;
                                try {
                                    localStorage.setItem("data", data);
                                    window.location.reload();
                                } catch (e) {
                                    console.error(e);
                                }
                            }}>
                                Paste data
                            </button>
                        </div>
                    </div>
                </details>

                <details className="card p-0 no-shadow">
                    <summary>
                        <h4>Factura</h4>
                    </summary>

                    <div className="hstack f-wrap p-def">
                        <div className="f-column vstack f-grow">
                            <label>Factura #</label>
                            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}/>
                        </div>
                        <div className="f-column vstack f-grow">
                            <label>Creada</label>
                            <input value={created} onChange={(e) => setCreated(e.target.value)}/>
                        </div>
                        <div className="f-column vstack f-grow">
                            <label>Fecha de vencimiento</label>
                            <input value={due} onChange={(e) => setDue(e.target.value)}/>
                        </div>
                        <div className="f-column vstack">
                            <label>Mostrar logo</label>
                            <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)}/>
                        </div>
                        <div className="f-column vstack">
                            <label>Pagada</label>
                            <input type="checkbox" onChange={(e) => setPaid(e.target.checked)}/>
                        </div>
                    </div>

                    <div className="f-column vstack p-def">
                        <label>Descripcion</label>
                        <input value={description} onChange={(e) => setDescription(e.target.value)}/>
                    </div>
                    <div className="hstack f-wrap p-def">
                        <div className="f-column vstack f-grow">
                            <label>Cantidad</label>
                            <input type="number" value={quantity}
                                   onChange={(e) => setQuantity(parseInt(e.target.value))}/>
                        </div>
                        <div className="f-column vstack f-grow">
                            <label>Rate</label>
                            <input value={rate} type="number" onChange={(e) => setRate(parseInt(e.target.value))}/>
                        </div>
                    </div>

                </details>

                <CompanyForm
                    title="Compañía"
                    company={company}
                    setCompany={setCompany}
                />

                <CompanyForm
                    title="Compañía a facturar"
                    company={companyToBill}
                    setCompany={setCompanyToBill}
                />

                <div>
                    <button
                        id="printButton"
                        onClick={() => {
                            saveToLocalStorage();
                            window.print();
                        }}
                    >
                        Print invoice
                    </button>
                </div>
            </div>

            <br/>
            <br/>

            <Invoice
                invoiceNumber={invoiceNumber}
                created={created}
                due={due}
                items={[
                    {
                        description,
                        quantity,
                        rate
                    }
                ]}
                showLogo={showLogo}
                company={company}
                paid={paid}
                companyToBill={companyToBill}
                language={language}
            />

            <br/>
            <br/>
        </>
    );
}
