import type {Route} from "./+types/home";
import {Invoice} from "~/components/Invoice";
import styles from "./home.module.css";
import {useEffect, useState} from "react";

export function meta({}: Route.MetaArgs) {
    return [
        {title: "New React Router App"},
        {name: "description", content: "Welcome to React Router!"},
    ];
}

export default function Home() {
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [created, setCreated] = useState("");
    const [due, setDue] = useState("");
    const [description, setDescription] = useState("");
    const [showLogo, setShowLogo] = useState(true);

    const [company, setCompany] = useState({
        name: "Example Company",
        address: "1234 Main St",
        city: "Springfield",
        country: "USA",
        email: "example@example.com",
        postalCode: "12345"
    });

    const saveToLocalStorage = () => {
        localStorage.setItem("data", JSON.stringify({
            invoiceNumber, created, due, description,
            company,
            showLogo
        }));
    }

    useEffect(() => {
        //save and load from local storage
        const data = localStorage.getItem("data");
        if (data) {
            const parsedData = JSON.parse(data);
            setInvoiceNumber(parsedData.invoiceNumber);
            setCreated(parsedData.created);
            setDue(parsedData.due);
            setDescription(parsedData.description);
            setCompany(parsedData.company);
            setShowLogo(parsedData.showLogo);
        }
    }, []);

    return (
        <>
            <nav className={`${styles.nav} noPrint`}>
                <div className={`${styles.navContent} w-100 m-auto `}>
                    <h2>
                        DInvoicing
                    </h2>
                </div>
            </nav>
            <br/>
            <div className={`${styles.controls} w-100 m-auto noPrint vstack`}>
                <h4>Factura</h4>
                <div className={"hstack"}>
                    <div className="f-column vstack">
                        <label>Factura #</label>
                        <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}/>
                    </div>
                    <div className="f-column vstack">
                        <label>Creada</label>
                        <input value={created} onChange={(e) => setCreated(e.target.value)}/>
                    </div>
                    <div className="f-column vstack">
                        <label>Fecha de vencimiento</label>
                        <input value={due} onChange={(e) => setDue(e.target.value)}/>
                    </div>
                    <div className="f-column vstack">
                        <label>Mostrar logo</label>
                        <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)}/>
                    </div>
                </div>
                <div className="f-column vstack">
                    <label>Descripcion</label>
                    <input value={description} onChange={(e) => setDescription(e.target.value)}/>
                </div>
                <div className={"separator"}/>
                <h4>Compañía</h4>
                <div className="hstack f-wrap">
                    <div className="f-column vstack">
                        <label>Nombre</label>
                        <input value={company.name} onChange={(e) => setCompany({...company, name: e.target.value})}/>
                    </div>
                    <div className="f-column vstack">
                        <label>Dirección</label>
                        <input value={company.address}
                               onChange={(e) => setCompany({...company, address: e.target.value})}/>
                    </div>
                    <div className="f-column vstack">
                        <label>Ciudad</label>
                        <input value={company.city} onChange={(e) => setCompany({...company, city: e.target.value})}/>
                    </div>
                    <div className="f-column vstack">
                        <label>País</label>
                        <input value={company.country}
                               onChange={(e) => setCompany({...company, country: e.target.value})}/>
                    </div>
                    <div className="f-column vstack">
                        <label>Email</label>
                        <input value={company.email} onChange={(e) => setCompany({...company, email: e.target.value})}/>
                    </div>
                    <div className="f-column vstack">
                        <label>Código postal</label>
                        <input value={company.postalCode}
                               onChange={(e) => setCompany({...company, postalCode: e.target.value})}/>
                    </div>
                </div>
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
                        description: description,
                        quantity: 160,
                        rate: 25
                    }
                ]}
                showLogo={showLogo}
                company={company}
            />
        </>
    );
}
