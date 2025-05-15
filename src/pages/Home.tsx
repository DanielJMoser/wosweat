import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import './Home.css';

const Home: React.FC = () => {
    const venues = [
        { name: 'Treibhaus', url: 'https://www.treibhaus.at/programm' },
        // Add more venues as needed
    ];

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>My Event Calendar</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <IonHeader collapse="condense">
                    <IonToolbar>
                        <IonTitle size="large">My Event Calendar</IonTitle>
                    </IonToolbar>
                </IonHeader>
            </IonContent>
        </IonPage>
    );
};

export default Home;
